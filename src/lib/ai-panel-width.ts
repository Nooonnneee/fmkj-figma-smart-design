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
/** localStorage 键名，与 sidebar.tsx 的 `fmkj:sidebar-width` 一致命名空间。 */
export const AI_PANEL_WIDTH_STORAGE_KEY = 'fmkj:ai-panel-width'
export const AI_PANEL_COLLAPSED_STORAGE_KEY = 'fmkj:ai-panel-collapsed'

/** 把一次拖拽得到的原始宽度夹到 [MIN, MAX]，并取整。 */
export function clampAiPanelWidth(value: number): number {
  return Math.round(Math.min(AI_PANEL_MAX_WIDTH, Math.max(AI_PANEL_MIN_WIDTH, value)))
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** 从持久存储读出已保存的宽度；无有效值/越界时回落到默认。 */
export function readStoredAiPanelWidth(storage: StorageLike = window.localStorage): number {
  try {
    const saved = storage.getItem(AI_PANEL_WIDTH_STORAGE_KEY)
    const parsed = saved ? Number(saved) : NaN
    if (Number.isFinite(parsed)) return clampAiPanelWidth(parsed)
  } catch {
    // ignore storage errors
  }
  return AI_PANEL_DEFAULT_WIDTH
}

/** 把宽度写回持久存储；写失败静默忽略（隐私模式等场景）。 */
export function writeAiPanelWidth(value: number, storage: StorageLike = window.localStorage): void {
  try {
    storage.setItem(AI_PANEL_WIDTH_STORAGE_KEY, String(clampAiPanelWidth(value)))
  } catch {
    // ignore storage errors
  }
}

/** 读出收起态；默认展开。 */
export function readStoredAiPanelCollapsed(storage: StorageLike = window.localStorage): boolean {
  try {
    return storage.getItem(AI_PANEL_COLLAPSED_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** 写入收起态。 */
export function writeAiPanelCollapsed(
  collapsed: boolean,
  storage: StorageLike = window.localStorage,
): void {
  try {
    storage.setItem(AI_PANEL_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0')
  } catch {
    // ignore storage errors
  }
}
