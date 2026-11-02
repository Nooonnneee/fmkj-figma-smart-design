import { deviceLook } from '@/board/packs/smart-home/look'

/**
 * 点位图标的图片地址（打印、方案演示、图例共用，与画板上的图形一致）：
 * 有选定的点位图标用图标（public/point-icons/*.png），否则用实心标记（public/point-markers/*.svg）。
 * 只返回静态地址，不把图片数据打进前端脚本。
 */
export const markerSrc = (type: string) => deviceLook(type).marker ?? ''
