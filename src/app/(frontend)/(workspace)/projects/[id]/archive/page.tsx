import Link from 'next/link'
import { Check, ChevronRight, Circle, History } from 'lucide-react'

import { relId } from '@/lib/access'
import { getCompanyInfo } from '@/lib/cached-data'
import { contractStatusLabel, fmtLongDate, paymentAmounts } from '@/lib/contracts'
import { FINAL_QUOTE_SOURCE_LABEL, resolveFinalQuote } from '@/lib/deliverables'
import { FEATURE_TIERS, featureAccess, tierBadge } from '@/lib/membership'
import { getMembershipContext } from '@/lib/membership-policy'
import { inferScopeFromTitle } from '@/lib/point-scopes'
import { projectDisplayName, quoteShortTitle } from '@/lib/project-name'
import { quoteStatusLabel, yuan } from '@/lib/quotes'
import { cn } from '@/lib/utils'
import { loadProposalTemplates } from '@/plugins/proposal/registry'
import { DEFAULT_PROPOSAL_TEMPLATE, resolveProposalTemplate } from '@/plugins/proposal/templates'
import { getPluginFlags } from '@/plugins/state'

import { getProject, getProjectDeals } from '../project-data'
import { ArchiveButton } from './archive-button'
import { CopyClientLinkButton } from './copy-client-link'
import { DeliveryPackage, type DeliveryDoc } from './delivery-package'
import { parseShareConfig } from '@/lib/project-access'

/** 归档：核对资料 → 确认定稿（一份报价、一份方案）→ 打包交付资料 → 归档（项目转为只读）。 */
export default async function ProjectArchivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [{ user, payload, project, archived, role, readOnly }, { quotes, contract }] = await Promise.all([getProject(id), getProjectDeals(id)])
  const rawShare = (project as unknown as { shareConfig?: unknown }).shareConfig
  const shareConfig = parseShareConfig(rawShare)
  if (!rawShare || typeof (rawShare as { token?: unknown })?.token !== 'string') {
    await payload.update({ collection: 'projects', id: project.id, data: { shareConfig } as never, overrideAccess: true, depth: 0 }).catch(() => null)
  }
  const ownerId = relId(project.owner) || user.id
  const [flags, templates, company, access] = await Promise.all([getPluginFlags(ownerId), loadProposalTemplates(user), getCompanyInfo(ownerId), getMembershipContext(user)])
  const pid = String(project.id)
  const points = project.pointCount ?? 0
  const final = resolveFinalQuote(quotes, { contractQuoteId: relId(contract?.quote), finalQuoteId: relId(project.finalQuote) })
  const finalQuote = final.quote
  const payments = contract?.payments ?? []
  const amounts = paymentAmounts(contract?.amount ?? 0, payments)
  const received = payments.filter((p) => p.received).length
  const deckTemplates = templates.filter((t) => t.framework !== 'construction')
  const tpl =
    resolveProposalTemplate(project.proposalTemplate, deckTemplates) ??
    resolveProposalTemplate(DEFAULT_PROPOSAL_TEMPLATE, deckTemplates) ??
    deckTemplates[0] ??
    null
  const construction = templates.find((t) => t.framework === 'construction') ?? null
  const qTitle = (q: { title: string }) => quoteShortTitle(q.title, project.name)

  const checks = [
    { label: '点位图', done: points > 0, note: points ? `${points} 个点位` : '还没有布置点位', href: `/projects/${pid}/point-map` },
    {
      label: '定稿报价',
      done: Boolean(finalQuote && (final.source === 'contract' || final.source === 'chosen' || finalQuote.status === 'accepted')),
      note: finalQuote ? `${qTitle(finalQuote)} · ${FINAL_QUOTE_SOURCE_LABEL[final.source!]} · ${yuan(finalQuote.total)}` : '还没有报价',
      href: finalQuote ? `/projects/${pid}/quotes/${finalQuote.id}` : `/projects/${pid}/quotes`,
    },
    {
      label: '合同',
      done: contract?.status === 'signed',
      note: contract ? `${contract.number} · ${contractStatusLabel(contract.status)}${contract.signedAt ? ` · ${fmtLongDate(contract.signedAt)}` : ''}` : '还没有合同',
      href: `/projects/${pid}/contract`,
    },
    {
      label: '收款',
      done: payments.length > 0 && received === payments.length,
      note: payments.length
        ? `${received}/${payments.length} 期已收 · ${yuan(payments.reduce((s, p, i) => s + (p.received ? amounts[i] : 0), 0))}`
        : contract
          ? '合同里没有付款计划'
          : '签订合同后在「合同」里登记收款',
      href: `/projects/${pid}/contract`,
    },
  ]
  const ready = checks.every((c) => c.done)

  const proposalUrl =
    flags.proposal && points && tpl
      ? `/print/projects/${pid}/proposal?${new URLSearchParams({
          template: tpl.value,
          ...(finalQuote ? { quoteId: String(finalQuote.id), scope: inferScopeFromTitle(finalQuote.title) } : {}),
        }).toString()}`
      : null
  const docs: DeliveryDoc[] = [
    { key: 'plans', title: '点位图', note: points ? `${points} 个点位` : '未布置点位', url: points ? `/print/projects/${pid}/plans` : null, defaultOn: true },
    { key: 'checklist', title: '点位交底清单', note: points ? '' : '未布置点位', url: points ? `/print/projects/${pid}/checklist` : null, defaultOn: true },
    {
      key: 'quote',
      title: '定稿报价单',
      note: finalQuote ? yuan(finalQuote.total) : '未生成报价',
      url: finalQuote ? `/print/quotes/${finalQuote.id}` : null,
      defaultOn: true,
    },
    ...(flags.proposal
      ? [
          {
            key: 'proposal' as const,
            title: tpl ? `方案（${tpl.label}）` : '方案',
            note: points ? '' : '未布置点位',
            url: proposalUrl,
            defaultOn: true,
          },
        ]
      : []),
    { key: 'contract', title: '合同', note: contract ? contract.number : '未生成合同', url: contract ? `/print/contracts/${contract.id}` : null, defaultOn: true },
    ...(flags.proposal && construction
      ? [
          {
            key: 'construction' as const,
            title: '施工交底',
            note: points ? '' : '未布置点位',
            url: points ? `/print/projects/${pid}/proposal?template=${construction.value}` : null,
            defaultOn: false,
          },
        ]
      : []),
    ...(flags['wiring-schedule']
      ? [
          {
            key: 'wiring' as const,
            title: '强弱电布线表',
            note: points ? '' : '未布置点位',
            url: points ? `/print/projects/${pid}/wiring` : null,
            defaultOn: false,
          },
        ]
      : []),
    ...(flags.procurement
      ? [
          {
            key: 'procurement' as const,
            title: '采购与备货单',
            note: points ? '' : '未布置点位',
            url: points ? `/print/projects/${pid}/procurement?cost=0` : null,
            defaultOn: false,
          },
        ]
      : []),
    ...(flags['scene-handover']
      ? [
          {
            key: 'handover' as const,
            title: '场景与账号移交单',
            note: points ? '' : '未布置点位',
            url: points ? `/print/projects/${pid}/handover` : null,
            defaultOn: true,
          },
        ]
      : []),
    ...(flags['site-survey']
      ? [
          {
            key: 'survey' as const,
            title: '现场勘测确认单',
            note: '',
            url: `/print/projects/${pid}/survey`,
            defaultOn: false,
          },
        ]
      : []),
  ]
  const pkg = featureAccess(access.membership, FEATURE_TIERS.package, access.strict)
  const otherQuotes = quotes.filter((q) => String(q.id) !== String(finalQuote?.id ?? ''))
  const otherTemplates = flags.proposal && points ? deckTemplates.filter((t) => t.value !== tpl?.value) : []

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">归档</h2>
          {archived ? <p className="text-sm text-muted-foreground">已于 {fmtLongDate(project.archivedAt)} 归档（只读）</p> : null}
        </div>
        {shareConfig.enabled ? <CopyClientLinkButton token={shareConfig.token} /> : null}
      </header>

      <DeliveryPackage
        projectId={pid}
        projectName={projectDisplayName(project.name)}
        editable={!readOnly}
        docs={docs}
        quotes={quotes.map((q) => ({ value: String(q.id), label: `${qTitle(q)} · ${yuan(q.total)}` }))}
        finalQuote={{ id: finalQuote ? String(finalQuote.id) : null, sourceLabel: final.source ? FINAL_QUOTE_SOURCE_LABEL[final.source] : null, locked: final.source === 'contract' }}
        templates={deckTemplates.map((t) => ({ value: t.value, label: t.tier === 'free' ? t.label : `${t.label} · ${tierBadge(t.tier)}` }))}
        template={tpl?.value ?? ''}
        cover={{
          company: company.name,
          customer: project.customerName ?? '',
          address: [project.community, project.address].filter(Boolean).join(' '),
          date: new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'long', day: 'numeric' }),
        }}
        access={{ meets: pkg.meets, allowed: pkg.allowed, badge: tierBadge(FEATURE_TIERS.package), hint: access.upgradeHint }}
      />

      {role !== 'read' ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed px-5 py-4">
          <div className="text-sm">
            <div className="font-medium">{archived ? '恢复为进行中项目' : ready ? '资料已齐备，可归档' : '归档项目'}</div>
            <div className="text-xs text-muted-foreground">{archived ? '恢复后可继续编辑点位、报价和合同' : '归档后转为只读，仍可查看与导出资料'}</div>
          </div>
          <ArchiveButton projectId={pid} archived={archived} primary={ready} />
        </section>
      ) : null}
    </div>
  )
}
