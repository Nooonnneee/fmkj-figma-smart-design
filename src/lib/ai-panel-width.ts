/**
 * 右栏（AiPanel）拖宽 / 收起态的宽度与持久化（纯函数，单测见 ai-panel-width.test.ts）。
 *
 * 与左侧栏（sidebar.tsx）共用同一套思路：Min/Max 夹紧 + localStorage 记忆。
 * 单独抽成 lib 是为了让「宽度计算 / 存储读写」能被真实行为单测到——
 * 纯 UI 拖拽事件难测，但夹紧和存储往返是确定性的，值得盯住。
 */
export const AI_PANEL_MIN_WIDTH = 240
export const AI_PANEL_DEFAULT_WIDTH = 320
export const AI_PANEL_MAX_WIDTH = 480
/** 收起后的竖条宽度，与左栏 icon 态同宽（原来的 w-10）。 */
export const AI_PANEL_COLLAPSED_WIDTH = 40
/** localStorage 键名，与 sidebar.tsx 的 `fmkj:sidebar-width` 一致命名空间。 */
export const AI_PANEL_WIDTH_STORAGE_KEY = 'fmkj:ai-panel-width'
export const AI_PANEL_COLLAPSED_STORAGE_KEY = 'fmkj:ai-panel-collapsed'

/** 把一次拖拽得到的原始宽度夹到 [MIN, MAX]，并取整。 */
export function clampAiPanelWidth(value: number): number {
  return Math.round(Math.min(AI_PANEL_MAX_WIDTH, Math.max(AI_PANEL_MIN_WIDTH, value)))
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/**
 * 取默认存储；SSR（无 window）或 localStorage 不可用时返回 null。
 *
 * 注意别把 `window.localStorage` 写回默认参数：默认参数在**调用时**求值，
 * 服务端渲染没有 window，会在调用处直接抛 ReferenceError。这里用
 * `typeof window` 判断，未定义时也不抛错。
 */
function getDefaultStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** 从持久存储读出已保存的宽度；无存储/无有效值/越界时回落到默认。 */
export function readStoredAiPanelWidth(storage: StorageLike | null = getDefaultStorage()): number {
  if (!storage) return AI_PANEL_DEFAULT_WIDTH
  try {
    const saved = storage.getItem(AI_PANEL_WIDTH_STORAGE_KEY)
    const parsed = saved ? Number(saved) : NaN
    if (Number.isFinite(parsed)) return clampAiPanelWidth(parsed)
  } catch {
    // ignore storage errors
  }
  return AI_PANEL_DEFAULT_WIDTH
}

/** 把宽度写回持久存储；无存储/写失败静默忽略（SSR、隐私模式等场景）。 */
export function writeAiPanelWidth(
  value: number,
  storage: StorageLike | null = getDefaultStorage(),
): void {
  if (!storage) return
  try {
    storage.setItem(AI_PANEL_WIDTH_STORAGE_KEY, String(clampAiPanelWidth(value)))
  } catch {
    // ignore storage errors
  }
}

/** 读出收起态；无存储时默认展开。 */
export function readStoredAiPanelCollapsed(
  storage: StorageLike | null = getDefaultStorage(),
): boolean {
  if (!storage) return false
  try {
    return storage.getItem(AI_PANEL_COLLAPSED_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** 写入收起态；无存储时静默忽略。 */
export function writeAiPanelCollapsed(
  collapsed: boolean,
  storage: StorageLike | null = getDefaultStorage(),
): void {
  if (!storage) return
  try {
    storage.setItem(AI_PANEL_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0')
  } catch {
    // ignore storage errors
  }
}
