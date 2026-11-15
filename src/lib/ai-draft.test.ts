import { describe, expect, it } from 'vitest'

import { aiDraftKey, readAiDraft, writeAiDraft } from './ai-draft'

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
