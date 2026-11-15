/**
 * AI 对话输入框草稿的存取（纯函数，单测见 ai-draft.test.ts）。
 *
 * 为什么需要：`AiSidebarDock` 的 input 是组件内 state，而面板在
 * `inline / drawer` 之间切换（跨 1440 断点）或抽屉关开时会整体卸载，
 * 未发送的草稿会静默丢失。实测（干净树，1440↔1439）：
 *   inline 输入 → 缩到 1439 → 回到 1440 → 输入框为空；
 *   抽屉输入 → Esc → 重开 → 为空。
 *
 * 存 sessionStorage 而不是 localStorage：草稿只在当前标签页有意义，
 * 关掉标签页就该消失，避免下次打开看到几天前的半句话。
 *
 * 键必须按「用户 + 会话」隔离：同一个浏览器换账号登录时，A 的草稿
 * 不能出现在 B 的输入框里；不同会话各自的草稿也不能互相覆盖。
 * 新对话（还没拿到服务端 conversationId）用固定后缀 `new`。
 */

const PREFIX = 'fmkj:ai-draft'

/** 草稿存储只需要这三个方法（方便测试注入替身）。 */
export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** 草稿键：用户 + 会话。conversationId 为空表示「新对话」。 */
export function aiDraftKey(userId: string, conversationId: string | null): string {
  // 真实会话加 `c:` 前缀，避免会话 id 恰好是 'new' 时和「新对话」的键撞上。
  return `${PREFIX}:${userId}:${conversationId ? `c:${conversationId}` : 'new'}`
}

/**
 * 安全地取 sessionStorage。
 *
 * 浏览器禁用存储（隐私模式 / 企业策略）时，抛 SecurityError 的不是
 * `getItem`，而是**属性 getter 本身**：`window.sessionStorage` 一读就炸。
 * 只把方法调用包在 try 里不够 —— 表达式求值在进函数之前就抛了，Next 会
 * 直接把整页渲染成 "This page couldn't load"（右栏和正文一起白屏）。
 * 所以属性访问必须单独包起来，最坏退化成一页「没有草稿」。
 *
 * `read` 参数只为测试注入抛错的 getter，生产调用不带参数。
 */
export function getDraftStorage(
  read: () => DraftStorage | null = () =>
    typeof window === 'undefined' ? null : window.sessionStorage,
): DraftStorage | null {
  try {
    return read()
  } catch {
    return null
  }
}

/** 读草稿；没有、为空串或存储不可用（隐私模式）都返回 null。 */
export function readAiDraft(storage: Pick<Storage, 'getItem'> | null, key: string): string | null {
  if (!storage) return null
  try {
    const value = storage.getItem(key)
    return value ? value : null
  } catch {
    return null
  }
}

/** 会话切换时该显示哪条草稿：键没变就保持现状（用户正在打字），变了才读目标键。 */
export function draftOnKeyChange(
  previousKey: string,
  nextKey: string,
  storage: Pick<Storage, 'getItem'> | null,
  currentInput: string,
): { changed: boolean; value: string } {
  if (previousKey === nextKey) return { changed: false, value: currentInput }
  return { changed: true, value: readAiDraft(storage, nextKey) ?? '' }
}

/** 服务端确认受理这一轮：首个业务事件到达（meta / delta / tool）。status / reasoning 都不算。 */
export function isDraftAcceptedEvent(type: string): boolean {
  return type === 'meta' || type === 'delta' || type === 'tool'
}

export type AiDraftState<T> = { input: string; attachments: T[] }

/**
 * 发送失败时要还回去的草稿。用户在这期间已经重新输入/添加了内容时，
 * 以用户新输入的为准，不覆盖。
 *
 * `current` 必须是取值函数而不是对象：`send()` 闭包里捕获的 input/attachments
 * 是发送那一刻的旧值，等待期间用户继续输入更新的是新 state，旧闭包看不到。
 * 传函数才能读到实时值。
 */
export function restoreDraft<T>(
  snapshot: AiDraftState<T>,
  current: () => AiDraftState<T>,
): AiDraftState<T> {
  const live = current()
  return {
    input: live.input || snapshot.input,
    attachments: live.attachments.length ? live.attachments : snapshot.attachments,
  }
}

/**
 * 请求失败时的结局判定（与 fix/byok-draft-net 的 decideDraftOnFailure 同一语义）：
 *
 * - 受理前失败：这一轮什么都没发生 → 恢复草稿（内存 + sessionStorage），收起失败气泡。
 * - 受理后失败：用户消息已落库、草稿已在受理时清空 → 再还回去会变成「旧文重返
 *   输入框、再发一次 = 历史里同一条用户消息两遍」。保留错误气泡。
 */
export type DraftFailureDecision<T> =
  | { kind: 'restore-draft'; draft: AiDraftState<T> }
  | { kind: 'keep-error' }

export function resolveDraftOnFailure<T>(
  accepted: boolean,
  storage: DraftStorage | null,
  key: string,
  snapshot: AiDraftState<T>,
  current: () => AiDraftState<T>,
): DraftFailureDecision<T> {
  if (accepted) return { kind: 'keep-error' }
  const draft = restoreDraft(snapshot, current)
  // 内存里的输入框与 sessionStorage 必须一起恢复：只还原 state 的话，
  // 面板一卸载（跨断点 / 关抽屉）草稿又没了。
  writeAiDraft(storage, key, draft.input)
  return { kind: 'restore-draft', draft }
}

/** 写草稿；空串等价于删除，避免留下无意义的键。存储异常一律忽略。 */
export function writeAiDraft(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null,
  key: string,
  value: string,
): void {
  if (!storage) return
  try {
    if (value) storage.setItem(key, value)
    else storage.removeItem(key)
  } catch {
    // 存储已满 / 被禁用：草稿丢失不应影响发送。
  }
}
