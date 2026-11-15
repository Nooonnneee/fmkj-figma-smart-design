import { EmptyState } from '@/components/empty-state'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Palette, Sparkles } from 'lucide-react'

import { Button } from '@astryxdesign/core/Button'
import { PageHeader, PageShell } from '@/components/page-header'
import { appAuth } from '@/lib/app-auth'
import { pageTitle } from '@/lib/brand'
import { getPluginFlags } from '@/plugins/state'
import { IMAGE_MODELS, imageGenerationConfigured } from '@/plugins/ai-copilot/image-generation'

import { ImageGenerator } from './image-generator'

export const metadata = { title: pageTitle('AI 生图') }

export default async function AiImagePage() {
  const user = await appAuth.getCurrentUser()
  if (!user) redirect('/login?from=/ai/image')
  const flags = await getPluginFlags(user.id)
  if (!flags['ai-copilot']) {
    return (
      <PageShell>
        <PageHeader title="AI 生图" />
        <section className="flex w-full flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-14">
          <EmptyState
            icon={<Sparkles className="size-5" />}
            title="「AI 对话侧栏（高级）」插件已关闭"
            description="AI 生图依赖 AI 插件，请先在插件中心开启。"
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
        title="AI 生图"
        description="用文字描述生成智能家居场景图、方案配图、材质意向图。"
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              href="/ai/image/style"
              icon={<Palette />}
              label="户型图风格化"
            />
            <Button
              variant="ghost"
              size="sm"
              href="/ai"
              icon={<ArrowLeft />}
              label="返回 AI 对话"
            />
          </>
        }
      />
      <ImageGenerator
        configured={imageGenerationConfigured()}
        models={IMAGE_MODELS.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description,
          sizes: [...m.sizes],
          cost: m.cost,
        }))}
      />
    </PageShell>
  )
}
