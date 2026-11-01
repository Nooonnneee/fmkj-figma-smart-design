import type { PaperId } from './paper'
import type { SymbolLook } from './symbols'
import type { BoardDoc, LayerId, SymbolObj } from './types'

export type CheckLevel = 'error' | 'warning' | 'info'

/** 检查结果：点击可定位到 targets（对象 ID） */
export type CheckIssue = { id: string; level: CheckLevel; title: string; detail?: string; targets: string[] }

export type LegendRow = { key: string; label: string; count: number; look: SymbolLook }

/**
 * 系统包：一个专业（智能家居点位、灯光、平面家居、暖通、给排水……）的全部业务知识。
 * 引擎只通过这个接口和业务打交道：符号怎么画、图例怎么出、要检查什么、导出用什么模板。
 */
export type SystemPack = {
  id: string
  name: string
  /** 默认纸张和比例 */
  paper: PaperId
  scale: number
  /** 图层名称（引擎的通用图层 → 本专业的叫法） */
  layers: { id: LayerId; name: string }[]
  /** 解释符号：名称、颜色、平面符号、实心标记 */
  look: (o: Pick<SymbolObj, 'symbolId' | 'data'>) => SymbolLook
  /** 图纸检查 */
  check: (doc: BoardDoc) => CheckIssue[]
  /** 图例（按 look.key 汇总） */
  legend: (doc: BoardDoc) => LegendRow[]
  /** 导出模板 */
  export: { title: string; note: string }
}
