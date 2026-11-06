/** 网络与摄像头均有点位时，按实际区域组合成一张配置总览。 */
import { PointMarker } from '@/components/point-marker'
import { deviceTypeOf } from '@/lib/device-types'

import { codeRange, type DeckItem, type DeckPoint } from '../model'
import type { NetworkCameraModel, NetworkCameraRoom } from '../network-camera'
import { Chapter, SectionTitle, Slide, type DeckCtx } from '../parts'

const CAMERA = 'camera'

function typeCounts(points: DeckPoint[]) {
  const counts = new Map<string, number>()
  for (const p of points) counts.set(p.deviceType, (counts.get(p.deviceType) ?? 0) + 1)
  return [...counts].map(([type, count]) => `${deviceTypeOf(type)?.name ?? '设备'} ×${count}`).join(' · ')
}

function ConfigurationNode({ type, title, count, description }: { type: string; title: string; count: number; description: string }) {
  return (
    <div className="flex min-w-0 items-center gap-[16px] rounded-(--deck-radius-sm) border border-doc-rule bg-(--deck-panel) px-[18px] py-[16px]">
      <PointMarker type={type} className="size-[46px]" />
      <div className="min-w-0 flex-1">
        <p className="doc-display text-[20px] leading-[1.35]">{title}</p>
        <p className="doc-body mt-[5px] text-[13px] leading-[1.5] text-doc-muted">{description}</p>
      </div>
      <p className="doc-latin shrink-0 text-[30px] leading-none text-doc-accent">{count}</p>
    </div>
  )
}

function ModelSummary({ title, items, points }: { title: string; items: DeckItem[]; points: DeckPoint[] }) {
  const shown = items.slice(0, 2)
  const pending = points.filter((p) => !p.productId).length
  const unlinked = points.filter((p) => p.productId && !p.ref).length
  return (
    <div className="flex min-w-0 flex-col rounded-(--deck-radius-sm) border border-doc-rule bg-(--deck-diagram) px-[18px] py-[14px]">
      <p className="doc-strong text-[16px] leading-normal">{title}</p>
      <div className="mt-[8px] flex flex-col gap-[8px]">
        {shown.map((item) => (
          <div key={item.ref} className="min-w-0">
            <p className="doc-body line-clamp-2 text-[14px] leading-[1.4] wrap-anywhere">
              <span className="doc-latin mr-[7px] text-[12px] text-doc-accent">{item.ref}</span>
              {item.pending ? `${item.typeName} · 待选型` : item.name}
            </p>
          </div>
        ))}
        {!shown.length ? <p className="doc-body text-[14px] leading-[1.5] text-doc-muted">{pending === points.length ? `${pending} 个点位待选型。` : `${points.length - pending} 个点位已选型号，见点位配置。`}</p> : null}
        {shown.length ? <p className="doc-body text-[12px] leading-[1.4] text-doc-muted">{items.length > shown.length ? `另 ${items.length - shown.length} 项；` : ''}完整型号及数量见报价明细。</p> : null}
        {pending && (shown.length || pending < points.length) ? <p className="doc-body text-[12px] text-doc-muted">{pending} 个点位待选型。</p> : null}
        {unlinked ? <p className="doc-body text-[12px] leading-[1.4] text-doc-muted">{unlinked} 个点位未关联报价条目，见平面索引。</p> : null}
      </div>
    </div>
  )
}

function RegionRow({ room }: { room: NetworkCameraRoom }) {
  return (
    <div className="grid min-h-[64px] grid-cols-[1fr_56px_56px] items-center gap-[12px] border-b border-doc-rule py-[8px]">
      <div className="min-w-0">
        <p className="doc-strong line-clamp-2 text-[16px] leading-[1.35] wrap-anywhere">{room.floorName} · {room.name}</p>
        <p className="doc-latin mt-[4px] text-[12px] leading-[1.4] text-doc-muted wrap-anywhere">{codeRange(room.points.map((p) => p.code)) || '待编号'}</p>
      </div>
      <p className="doc-latin text-right text-[18px] text-doc-accent">{room.networkPoints.length || '—'}</p>
      <p className="doc-latin text-right text-[18px] text-doc-accent">{room.cameraPoints.length || '—'}</p>
    </div>
  )
}

export function NetworkCameraPage({ ctx, no, total, network }: { ctx: DeckCtx; no: number; total: number; network: NetworkCameraModel }) {
  const { networkPoints, cameraPoints, apPoints, corePoints, rooms, sheets, items, unmappedPoints } = network
  const networkItems = items.filter((item) => item.deviceType !== CAMERA)
  const cameraItems = items.filter((item) => item.deviceType === CAMERA)
  // 长区域名称占两行，减少本页展开数量，汇总行仍保留全部区域的点位计数。
  const roomLimit = rooms.some((room) => room.floorName.length + room.name.length > 22) ? 5 : 7
  const shownRooms = rooms.slice(0, rooms.length > roomLimit ? roomLimit - 1 : roomLimit)
  const otherRooms = rooms.slice(shownRooms.length)
  const otherNetwork = otherRooms.reduce((sum, room) => sum + room.networkPoints.length, 0)
  const otherCameras = otherRooms.reduce((sum, room) => sum + room.cameraPoints.length, 0)
  return (
    <Slide ctx={ctx} no={no} total={total} name="全屋网络与摄像头">
      <Chapter ctx={ctx} no={no} title="全屋网络与摄像头，一页看清。" subtitle="按房间与区域整理网络及监控配置 / 点位、型号与本项目对应" tag="NETWORK & CAMERAS" />
      <div className="flex min-h-0 w-full flex-1 flex-col gap-[18px] overflow-hidden">
        <div className="grid shrink-0 grid-cols-4 rounded-(--deck-radius-sm) border border-doc-rule bg-(--deck-diagram)">
          {[
            ['网络点位', networkPoints.length, '点'],
            ['摄像头', cameraPoints.length, '台'],
            ['涉及区域', rooms.length, '处'],
            ['涉及图纸', sheets.length, '张'],
          ].map(([label, count, unit], i) => (
            <div key={label} className={`flex items-baseline justify-between gap-[16px] px-[24px] py-[16px] ${i ? 'border-l border-doc-rule' : ''}`}>
              <p className="doc-body text-[15px] text-doc-muted">{label}</p>
              <p className="doc-latin text-[34px] leading-none text-doc-accent">{count}<span className="doc-body ml-[6px] text-[12px] text-doc-muted">{unit}</span></p>
            </div>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[772px_532px] items-start gap-[24px]">
          <div className="flex min-w-0 flex-col gap-[14px]">
            <SectionTitle title="网络与监控配置" note="按当前点位分组" />
            <div className="rounded-(--deck-radius) border border-(--deck-card-border) bg-(--deck-diagram) px-[22px] py-[18px]">
              <div className="mx-auto flex w-[440px] items-center gap-[14px] rounded-(--deck-radius-sm) border border-doc-accent/60 bg-(--deck-box) px-[20px] py-[14px]">
                <PointMarker type={corePoints[0]?.deviceType ?? apPoints[0]?.deviceType} className="size-[42px]" />
                <div className="min-w-0">
                  <p className="doc-display text-[20px] leading-[1.3]">本次网络配置</p>
                  <p className="doc-body mt-[4px] text-[13px] leading-[1.45] text-doc-muted">{typeCounts(networkPoints)}</p>
                </div>
              </div>
              <div aria-hidden className="mx-auto h-[18px] w-px bg-doc-accent/50" />
              <div className="mx-auto h-[16px] w-1/2 border-x border-t border-doc-accent/50" />
              <div className="grid grid-cols-2 gap-[16px]">
                <ConfigurationNode type={apPoints.length ? apPoints[0].deviceType : (corePoints[0]?.deviceType ?? 'network-panel')} title={apPoints.length ? '无线覆盖' : '网络接入'} count={apPoints.length || networkPoints.length} description={apPoints.length ? '面板 AP / 吸顶 AP' : '已配置的路由与网络面板'} />
                <ConfigurationNode type="camera" title="摄像头布置" count={cameraPoints.length} description="按区域核对监控点位" />
              </div>
              <p className="doc-body mt-[12px] text-center text-[12px] leading-normal text-doc-muted">设备分组示意，连接方式与供电条件以现场确认为准。</p>
            </div>
            <div className="grid grid-cols-2 items-start gap-[16px]">
              <ModelSummary title="网络型号" items={networkItems} points={networkPoints} />
              <ModelSummary title="摄像头型号" items={cameraItems} points={cameraPoints} />
            </div>
            <p className="doc-body text-[12px] leading-[1.6] text-doc-muted">网络覆盖以现场测试为准；摄像头朝向、供电与存储方式按设备配置及现场条件确认。</p>
          </div>

          <div className="flex min-w-0 flex-col">
            <SectionTitle title="房间与区域覆盖" note={`${rooms.length} 处区域`} />
            <div className="doc-body mt-[12px] grid grid-cols-[1fr_56px_56px] gap-[12px] border-b border-doc-rule pb-[9px] text-[12px] text-doc-muted">
              <span>区域 / 点位代号</span><span className="text-right">网络</span><span className="text-right">摄像头</span>
            </div>
            {shownRooms.map((room) => <RegionRow key={room.key} room={room} />)}
            {otherRooms.length ? (
              <div className="grid min-h-[64px] grid-cols-[1fr_56px_56px] items-center gap-[12px] border-b border-doc-rule py-[8px]">
                <div><p className="doc-strong text-[16px]">其余 {otherRooms.length} 处区域</p><p className="doc-body mt-[4px] text-[12px] text-doc-muted">完整区域与代号见住宅平面及报价明细</p></div>
                <p className="doc-latin text-right text-[18px] text-doc-accent">{otherNetwork || '—'}</p>
                <p className="doc-latin text-right text-[18px] text-doc-accent">{otherCameras || '—'}</p>
              </div>
            ) : null}
            <p className="doc-body mt-[12px] text-[12px] leading-[1.6] text-doc-muted">{unmappedPoints.length ? `其中 ${unmappedPoints.length} 个点位未上图，列入区域统计；安装位置待确认。` : '区域表与本项目点位一致；完整安装位置及编号见住宅平面。'}</p>
          </div>
        </div>
      </div>
    </Slide>
  )
}
