import { EmptyState } from '@/components/empty-state'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Palette } from 'lucide-react'

import { Button } from '@astryxdesign/core/Button'
import { PageHeader, PageShell } from '@/components/page-header'
import { appAuth } from '@/lib/app-auth'
import { pageTitle } from '@/lib/brand'
import { STYLE_TEMPLATES } from '@/lib/style-templates'
import { STYLE_TRANSFER_COST, styleTransferConfigured } from '@/plugins/ai-copilot/style-transfer'
import { getPluginFlags } from '@/plugins/state'

import { StyleTransfer } from './style-transfer'

export const metadata = { title: pageTitle('户型图风格化') }

export default async function StyleTransferPage() {
  const user = await appAuth.getCurrentUser()
  if (!user) redirect('/login?from=/ai/image/style')
  const flags = await getPluginFlags(user.id)
  if (!flags['ai-copilot']) {
    return (
      <PageShell>
        <PageHeader title="户型图风格化" />
        <section className="flex w-full flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-14">
          <EmptyState
            icon={<Palette className="size-5" />}
            title="「AI 对话侧栏（高级）」插件已关闭"
            description="户型图风格化依赖 AI 插件，请先在插件中心开启。"
            action={
              <Button
                size="sm"
                variant="secondary"
                href="/capabilities/ai-copilot"
                label="去插件页开启"
              />
            }
          />
        </section>
      </PageShell>
    )
  }
  return (
    <PageShell>
      <PageHeader
        title="户型图风格化"
        description="上传户型图，选择风格模板，保留墙体布局生成家具彩平图。"
        actions={
          <Button
            variant="ghost"
            size="sm"
            href="/ai/image"
            icon={<ArrowLeft />}
            label="返回 AI 生图"
          />
        }
      />
      <StyleTransfer
        configured={styleTransferConfigured()}
        cost={STYLE_TRANSFER_COST}
        templates={STYLE_TEMPLATES.map(({ id, name, description, file }) => ({
          id,
          name,
          description,
          file,
        }))}
      />
    </PageShell>
  )
}
