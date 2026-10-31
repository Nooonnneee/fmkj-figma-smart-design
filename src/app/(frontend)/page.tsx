import type { Metadata } from 'next'

import { LANDING_BRANDS } from '@/components/landing/brand-logos'
import { FeatureBento } from '@/components/landing/feature-bento'
import { Hero } from '@/components/landing/hero'
import { LandingFooter, LandingNav } from '@/components/landing/landing-chrome'
import { LogoMarquee } from '@/components/landing/logo-marquee'
import { QuoteShowcase } from '@/components/landing/quote-showcase'
import { FinalCta, PointMapSection, SceneSection, StatsBand, WorkflowSection } from '@/components/landing/sections'
import { MINIMAL_STYLE } from '@/documents/minimal'
import { DOC_KIND_LIST, DOC_KINDS } from '@/documents/registry'
import { APP_NAME } from '@/lib/brand'
import { DEVICE_TYPE_ORDER } from '@/lib/device-types'
import { PLUGIN_DOC_STYLES } from '@/plugins/doc-styles/styles'

export const metadata: Metadata = {
  title: `${APP_NAME} · 全屋智能方案工作台`,
  description: '上传户型图，AI 识别点位、智能选型，一键生成报价单、合同、方案演示与施工交底。为全屋智能设计师与集成商打造的方案工作台。',
}

/** 浏览器禁用脚本时，滚动出现的内容与点位图直接完整显示 */
const NOSCRIPT_CSS =
  '[data-reveal]{opacity:1!important;translate:none!important}[data-plan-marker],[data-play] g{opacity:1!important;animation:none!important}[data-play] path{stroke-dashoffset:0!important}'

const DOC_STYLES = [MINIMAL_STYLE, ...PLUGIN_DOC_STYLES]

/** 首页：面向全屋智能设计师与集成商的产品介绍（静态页面，进入工作台需登录）。 */
export default function HomePage() {
  const stats = [
    { label: '种设备点位图标', value: DEVICE_TYPE_ORDER.length },
    { label: '种报价单版式', value: DOC_KINDS.quote.layouts.length },
    { label: '套文档风格', value: DOC_STYLES.length },
    // 报价单、点位图、合同、交底清单，加上方案演示插件
    { label: '类文档一键导出', value: DOC_KIND_LIST.length + 1 },
    { label: '个主流品牌', value: LANDING_BRANDS.length },
  ]

  return (
    // 首页固定深色 + 品牌「繁梦紫」配色，不随访客选择的外观变化
    <div data-landing data-accent="fanmeng" className="dark relative min-h-svh overflow-x-clip bg-background text-foreground">
      <noscript>
        <style dangerouslySetInnerHTML={{ __html: NOSCRIPT_CSS }} />
      </noscript>
      <LandingNav />
      <main>
        <Hero />
        <LogoMarquee />
        <StatsBand stats={stats} />
        <PointMapSection deviceTypeCount={DEVICE_TYPE_ORDER.length} />
        <QuoteShowcase styles={DOC_STYLES} layouts={DOC_KINDS.quote.layouts} />
        <WorkflowSection />
        <SceneSection />
        <FeatureBento />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  )
}
