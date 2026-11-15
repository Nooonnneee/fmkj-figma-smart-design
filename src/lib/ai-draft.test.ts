import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  aiDraftKey,
  draftOnKeyChange,
  getDraftStorage,
  isDraftAcceptedEvent,
  readAiDraft,
  resolveDraftOnFailure,
  writeAiDraft,
} from './ai-draft'

/**
 * 接线断言：上面测的是纯函数语义，这里确保 dock 真的调用了它们。
 * 复核的变异测试证明过「把 dock 里整段写回删掉，326 个测试全绿」，
 * 所以纯函数之外必须有一条盯着调用点的用例。
 */
const dockSource = readFileSync(
  new URL('../components/ai/ai-sidebar-dock.tsx', import.meta.url),
  'utf8',
)

/** 最小 sessionStorage 替身：只实现草稿模块用到的三个方法。 */
function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    dump: () => Object.fromEntries(data),
  }
}

describe('aiDraftKey', () => {
  it('按用户 + 会话隔离', () => {
    const a = aiDraftKey('user-a', 'conv-1')
    const b = aiDraftKey('user-b', 'conv-1')
    const c = aiDraftKey('user-a', 'conv-2')
    expect(new Set([a, b, c]).size).toBe(3)
  })

  it('新对话用固定后缀，和真实会话不冲突', () => {
    const fresh = aiDraftKey('user-a', null)
    expect(fresh).not.toBe(aiDraftKey('user-a', 'new'))
    expect(fresh).toBe(aiDraftKey('user-a', null))
  })

  it('不同用户的同名会话不共键', () => {
    expect(aiDraftKey('u1', 'new')).not.toBe(aiDraftKey('u2', 'new'))
  })
})

describe('readAiDraft / writeAiDraft', () => {
  it('写进去能读回来（跨卸载后重挂靠的就是这条）', () => {
    const s = fakeStorage()
    const key = aiDraftKey('u1', null)
    writeAiDraft(s, key, '并排栏草稿-INLINE-777')
    expect(readAiDraft(s, key)).toBe('并排栏草稿-INLINE-777')
  })

  it('空串等价于删除，不留下无意义的键', () => {
    const s = fakeStorage()
    const key = aiDraftKey('u1', 'conv-1')
    writeAiDraft(s, key, '抽屉草稿-QQQ')
    writeAiDraft(s, key, '')
    expect(readAiDraft(s, key)).toBeNull()
    expect(s.dump()).toEqual({})
  })

  it('没存过返回 null（输入框初始化为空）', () => {
    expect(readAiDraft(fakeStorage(), aiDraftKey('u1', null))).toBeNull()
  })

  it('storage 为 null（SSR / 存储被禁用）不抛错', () => {
    expect(readAiDraft(null, 'k')).toBeNull()
    expect(() => writeAiDraft(null, 'k', 'x')).not.toThrow()
  })

  it('storage 抛异常时草稿失败不影响发送', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {
        throw new Error('denied')
      },
    }
    expect(readAiDraft(broken, 'k')).toBeNull()
    expect(() => writeAiDraft(broken, 'k', 'x')).not.toThrow()
  })
})

describe('发送失败后恢复草稿（阻断 1）', () => {
  const snapshot = { input: 'FAIL-500-DRAFT', attachments: [{ id: 'att-1' }] }

  it('受理前失败：内存与 sessionStorage 一起还原', () => {
    const s = fakeStorage()
    const key = aiDraftKey('u1', 'conv-1')
    // 发送瞬间清空（旧实现的时序）
    writeAiDraft(s, key, '')
    const decision = resolveDraftOnFailure(false, s, key, snapshot, () => ({
      input: '',
      attachments: [],
    }))
    expect(decision).toEqual({ kind: 'restore-draft', draft: snapshot })
    expect(readAiDraft(s, key)).toBe('FAIL-500-DRAFT')
  })

  it('受理后失败：不还原草稿（用户消息已落库，再发会重复）', () => {
    const s = fakeStorage()
    const key = aiDraftKey('u1', 'conv-1')
    const decision = resolveDraftOnFailure(true, s, key, snapshot, () => ({
      input: '',
      attachments: [],
    }))
    expect(decision).toEqual({ kind: 'keep-error' })
    expect(readAiDraft(s, key)).toBeNull()
  })

  it('等待期间用户重新输入：以新输入为准，不被旧快照覆盖', () => {
    const decision = resolveDraftOnFailure(false, fakeStorage(), 'k', snapshot, () => ({
      input: 'NEW-TYPE',
      attachments: [],
    }))
    expect(decision).toEqual({
      kind: 'restore-draft',
      draft: { input: 'NEW-TYPE', attachments: [{ id: 'att-1' }] },
    })
  })

  it('只有 meta / delta / tool 算受理', () => {
    expect(isDraftAcceptedEvent('meta')).toBe(true)
    expect(isDraftAcceptedEvent('delta')).toBe(true)
    expect(isDraftAcceptedEvent('tool')).toBe(true)
    expect(isDraftAcceptedEvent('status')).toBe(false)
    expect(isDraftAcceptedEvent('reasoning')).toBe(false)
  })

  it('dock 的发送流程确实接入了受理判定与失败恢复（删掉整段会变红）', () => {
    expect(dockSource).toContain('isDraftAcceptedEvent(ev.type) && !accepted')
    expect(dockSource).toContain('resolveDraftOnFailure(')
    expect(dockSource).toContain('setInputState(decision.draft.input)')
    expect(dockSource).toContain('setAttachments(decision.draft.attachments)')
  })
})

describe('换会话不串草稿（阻断 2）', () => {
  const keyA = aiDraftKey('u1', 'conv-a')
  const keyB = aiDraftKey('u1', 'conv-b')

  it('键变化时加载目标会话的草稿，而不是保留旧会话内容', () => {
    const s = fakeStorage()
    writeAiDraft(s, keyB, 'B-草稿')
    expect(draftOnKeyChange(keyA, keyB, s, 'A-草稿')).toEqual({
      changed: true,
      value: 'B-草稿',
    })
  })

  it('目标会话没有草稿时清空输入框', () => {
    expect(draftOnKeyChange(keyA, keyB, fakeStorage(), 'A-草稿')).toEqual({
      changed: true,
      value: '',
    })
  })

  it('键没变时不覆盖用户正在输入的内容', () => {
    expect(draftOnKeyChange(keyA, keyA, fakeStorage(), '正在打字')).toEqual({
      changed: false,
      value: '正在打字',
    })
  })

  it('dock 用上一次的键判断，只在键真正变化时同步', () => {
    expect(dockSource).toContain('draftOnKeyChange(draftKeyRef.current, draftKey')
    expect(dockSource).toContain('if (!sync.changed) return')
  })
})

describe('storage 被禁用时降级为无草稿（应修 3）', () => {
  it('sessionStorage 属性 getter 抛 SecurityError 时返回 null', () => {
    expect(
      getDraftStorage(() => {
        throw new Error('SecurityError: storage is disabled')
      }),
    ).toBeNull()
  })

  it('降级后读写草稿都不抛错', () => {
    const storage = getDraftStorage(() => {
      throw new Error('SecurityError: storage is disabled')
    })
    expect(readAiDraft(storage, 'k')).toBeNull()
    expect(() => writeAiDraft(storage, 'k', 'x')).not.toThrow()
  })

  it('dock 不直接访问 window.sessionStorage（否则禁用时整页白屏）', () => {
    expect(dockSource).not.toContain('window.sessionStorage')
    expect(dockSource).toContain('getDraftStorage()')
  })
})
