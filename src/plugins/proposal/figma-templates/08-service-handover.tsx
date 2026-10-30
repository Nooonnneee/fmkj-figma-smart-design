/**
 * Figma 方案模板 · 08 服务交付 · 付款与确认（1:1 对应 Figma 设计稿节点 8:6729）
 */
import { DocCheckbox } from '@/documents/parts'
import { paymentAmounts } from '@/lib/contracts'
import { acceptanceChecks, sceneNames } from '@/lib/project-docs'
import { yuan } from '@/lib/quotes'

import { FigmaChapter, FigmaSectionTitle, FigmaSlidePage, FigmaStepCard, FigmaTable, money, type FigmaTemplateCtx } from './shared'

/** 没有合同时的默认付款节点（与 Figma 设计稿 8:6783 完全一致） */
const SERVICE_NODES = [
  { name: '方案及合同确认后 / 备货前', percent: 40 },
  { name: '设备到场核验后 / 安装前', percent: 50 },
  { name: '联调验收、资料移交后', percent: 10 },
]

export function FigmaServicePage({ ctx, no, total }: { ctx: FigmaTemplateCtx; no: number; total: number }) {
  const { d } = ctx
  const scenes = sceneNames(d)
  const checks = acceptanceChecks(d)
  const nodes = d.contract?.payments?.length
    ? d.contract.payments.map((p) => ({ name: p.name, percent: p.percent }))
    : SERVICE_NODES
  const amount = ctx.finalAmount
  const amounts = paymentAmounts(amount, nodes)
  const advisorName = d.owner?.name || '项目专职顾问'
  const advisorPhone = d.owner?.phone || d.company.phone || '400-880-9688'
  const serviceAddr = [d.company.address, d.company.qrCaption].filter(Boolean).join(' / ') || '全屋智能体验中心 / 扫码添加专属顾问微信'

  return (
    <FigmaSlidePage ctx={ctx} no={no} total={total} frameName="08 服务交付 · 付款与确认">
      <FigmaChapter
        no={no}
        title="从一张方案，到每天安心使用。"
        subtitle="服务流程、付款与验收 / 让每个承诺，都有可核对的交付物"
        tag="SERVICE & HANDOVER"
      />
      <div className="flex h-[106px] w-full shrink-0 items-start gap-[28px] overflow-hidden" data-name="服务流程">
        <FigmaStepCard no="01" title="现场勘测" note="复核户型、供电、网络与安装条件" />
        <FigmaStepCard
          no="02"
          title="方案确认"
          note={
            scenes.length
              ? `核对${d.points.length}点、${scenes.length}场景、价格及边界`
              : `核对${d.points.length}个点位、价格及边界`
          }
        />
        <FigmaStepCard no="03" title="安装联调" note="设备到场核验，逐点安装与测试" />
        <FigmaStepCard no="04" title="验收培训" note="共同测试、账号移交与使用培训" />
      </div>

      <div className="flex w-full shrink-0 items-start gap-[40px] overflow-hidden" data-name="交付与付款确认">
        <div className="flex w-[600px] shrink-0 flex-col items-start gap-[15px] overflow-hidden" data-name="验收交付清单">
          <FigmaSectionTitle title="共同验收，逐项打勾" note="现场记录 / 双方签认" />
          <div
            className="doc-body flex w-full flex-col items-start gap-[13px] text-[15px] leading-[1.65] text-doc-ink"
            data-name="验收项目"
          >
            {checks.map((c) => (
              <p key={c} className="flex w-full items-start gap-[10px]">
                <DocCheckbox className="mt-[0.4em]" />
                <span>{c}</span>
              </p>
            ))}
          </div>
          <div className="h-px w-full bg-doc-rule" />
          <p className="doc-body w-full text-[13px] leading-[1.65] text-doc-muted">
            验收资料：点位与设备清单、场景规则、实测记录、账号交接及维护说明。设备保修与售后期限以正式合同、厂家条款为准；变更需先书面确认。
          </p>
          <div
            className="flex w-full flex-col items-start gap-[6px] overflow-hidden bg-linear-to-r from-doc-soft to-doc-soft-to p-[18px] text-doc-ink"
            data-name="服务联系占位"
          >
            <p className="doc-strong w-full text-[16px] leading-[1.65]">{d.company.name}</p>
            <div className="doc-body w-full text-[13px] whitespace-pre-wrap">
              <p className="leading-[1.65]">{`项目顾问：${advisorName}　 电话：${advisorPhone}`}</p>
              <p className="leading-[1.65]">{`服务地址 / 微信：${serviceAddr}`}</p>
            </div>
          </div>
        </div>

        <div className="flex w-[688px] shrink-0 flex-col items-start gap-[18px] overflow-hidden" data-name="付款与签署">
          <FigmaSectionTitle title="付款节点" note={`合计 ${yuan(amount)} / 比例可按合同约定`} />
          <FigmaTable
            columns={[
              { label: '比例', className: 'w-[90px]' },
              { label: '金额 / 元', className: 'w-[164px]' },
              { label: '支付条件', className: 'w-[434px]' },
            ]}
            rows={nodes.map((n, i) => [
              <span key="p" className="doc-strong text-doc-accent">{n.percent}%</span>,
              <span key="a" className="doc-body text-doc-ink">{money(amounts[i])}</span>,
              <span key="c" className="doc-body text-doc-ink">{n.name}</span>,
            ])}
          />
          <div
            className="flex w-full flex-col items-start gap-[13px] overflow-hidden border border-doc-rule bg-white p-[22px] leading-[1.65]"
            data-name="客户与实施方确认"
          >
            <p className="doc-strong w-full text-[20px] text-doc-ink">方案与实施边界确认</p>
            <p className="doc-body w-full text-[13px] text-doc-muted">
              请核对项目资料（{[d.project.community, d.project.address].filter(Boolean).join('') || d.project.name}）、{d.points.length}个点位、设备规格、费用及不含项后签署。此处确认方案与实施边界，不替代施工图审查或竣工验收；现场差异与增减费用须另行书面确认。
            </p>
            <div className="doc-body flex w-full items-start gap-[30px] overflow-hidden pt-[8px]" data-name="签署栏">
              <div className="flex min-w-px flex-1 flex-col items-start gap-[14px] overflow-hidden">
                <p className="w-full text-[13px] text-doc-ink">
                  客户签字：{d.project.customerName ? `${d.project.customerName}（签认）` : '________________'}
                </p>
                <p className="w-full text-[12px] text-doc-muted">日期：______年____月____日</p>
              </div>
              <div className="flex min-w-px flex-1 flex-col items-start gap-[14px] overflow-hidden">
                <p className="w-full text-[13px] text-doc-ink">
                  服务商 / 负责人：{d.owner?.name ? `${d.company.name} · ${d.owner.name}` : d.company.name}
                </p>
                <p className="w-full text-[12px] text-doc-muted">日期：______年____月____日</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </FigmaSlidePage>
  )
}
