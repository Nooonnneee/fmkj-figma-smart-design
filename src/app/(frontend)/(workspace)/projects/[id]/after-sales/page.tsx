import Link from 'next/link'
import { Lock, Wrench } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { relId } from '@/lib/access'
import { featureAccess, tierBadge } from '@/lib/membership'
import { getMembershipContext } from '@/lib/membership-policy'
import { loadAfterSales } from '@/lib/services/after-sales-service'
import { PLUGINS } from '@/plugins'
import { getPluginFlags } from '@/plugins/state'

import { getProject } from '../project-data'
import { AfterSalesBoard } from './after-sales-board'

/** 售后维保（插件）：质保倒计时、维保记录与配置备份。项目归档后仍可登记，仅查看的协作者只能浏览。 */
export default async function ProjectAfterSalesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, project, role, archived } = await getProject(id)
  const ownerId = relId(project.owner) || user.id
  const plugin = PLUGINS.find((p) => p.id === 'after-sales')
  const [flags, access] = await Promise.all([getPluginFlags(ownerId), getMembershipContext(user)])

  if (!flags['after-sales'] || !plugin) {
    const tier = featureAccess(access.membership, plugin?.tier ?? 'team', access.strict)
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted">
          {tier.allowed ? <Wrench className="size-5 text-muted-foreground" /> : <Lock className="size-5 text-muted-foreground" />}
        </span>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold">售后维保记录</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {tier.allowed
              ? '这个插件目前处于关闭状态。启用后可以按合同质保期追踪检修、设备更换与配置备份。'
              : `「售后维保记录」是 ${tierBadge(plugin?.tier ?? 'team')} 会员功能，升级后即可为每个项目建立质保台账。`}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={tier.allowed ? '/plugins/after-sales' : '/membership'}>{tier.allowed ? '去插件市场启用' : '查看会员权益'}</Link>
        </Button>
      </section>
    )
  }

  const full = await loadAfterSales(user, String(project.id))
  // 配置备份可能有上百台设备：页面只需要数量和最近一次备份的前几台，完整台账在打印页查看
  const data = {
    ...full,
    records: full.records.map((r) => (r.snapshot ? { ...r, snapshot: { ...r.snapshot, devices: [] } } : r)),
    latestBackup: full.latestBackup?.snapshot ? { ...full.latestBackup, snapshot: { ...full.latestBackup.snapshot, devices: full.latestBackup.snapshot.devices.slice(0, 5) } } : full.latestBackup,
  }
  const exportAccess = featureAccess(access.membership, plugin.tier, access.strict)
  return (
    <AfterSalesBoard
      projectId={String(project.id)}
      data={data}
      canEdit={role !== 'read'}
      archived={archived}
      tierLabel={tierBadge(plugin.tier)}
      exportLocked={!exportAccess.allowed}
    />
  )
}
