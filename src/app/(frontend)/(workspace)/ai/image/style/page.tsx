import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Palette } from 'lucide-react'

import { Button } from '@/components/ui/button'
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
      <section className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center">
        <Palette className="size-7 text-primary" />
        <h1 className="text-base font-semibold">「AI 对话侧栏（高级）」插件已关闭</h1>
        <p className="text-xs text-muted-foreground">
          户型图风格化依赖 AI 插件，请先在插件中心开启。
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href="/plugins/ai-copilot">去插件页开启</Link>
        </Button>
      </section>
    )
  }
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-primary">AI FLOOR PLAN</p>
          <h1 className="mt-1 text-2xl font-semibold">户型图风格化</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            上传户型图，选择风格模板，保留墙体布局生成家具彩平图。
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/ai/image">
            <ArrowLeft className="size-4" />
            返回 AI 生图
          </Link>
        </Button>
      </div>
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
    </div>
  )
}
