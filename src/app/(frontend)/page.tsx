import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { AppsSection } from '@/components/landing/apps-section'
import { DeliverySection } from '@/components/landing/delivery-section'
import { LandingFooter, LandingNav } from '@/components/landing/landing-chrome'
import { LibrarySection } from '@/components/landing/library-section'
import { PlanDemo } from '@/components/landing/plan-demo'
import { ProposalShowcase } from '@/components/landing/proposal-showcase'
import { QuoteShowcase } from '@/components/landing/quote-showcase'
import { Section } from '@/components/landing/section'
import { Button } from '@/components/ui/button'
import { MINIMAL_STYLE } from '@/documents/minimal'
import { DOC_KINDS } from '@/documents/registry'
import { APP_NAME } from '@/lib/brand'
import { getCompanyInfo } from '@/lib/cached-data'
import { getLandingShowcase } from '@/lib/landing-showcase'
import { PLUGIN_DOC_STYLES } from '@/plugins/doc-styles/styles'

export const metadata: Metadata = {
  title: `${APP_NAME} · 全屋智能方案工作台`,
  description: '在户型图上布好设备点位，系统按设备类型统计数量、匹配产品库型号，一键生成报价单、合同、方案演示与施工交底。为全屋智能设计师与集成商打造的方案工作台。',
}

const DOC_STYLES = [MINIMAL_STYLE, ...PLUGIN_DOC_STYLES]

/**
 * 首页：产品本身就是展示。数据来自系统内置的示例母版项目，
 * 按小时重新生成（示例母版很少改动；改动后最迟一小时生效）。
 */
export const revalidate = 3600

export default async function HomePage() {
  const [data, company] = await Promise.all([getLandingShowcase().catch(() => null), getCompanyInfo().catch(() => null)])
  const hasDemo = Boolean(data?.sheets.length)
  return (
    <div data-landing className="min-h-svh overflow-x-clip bg-background text-foreground">
      <LandingNav />
      <main>
        <section aria-labelledby="hero-title" className="px-4 pt-20 sm:px-6 sm:pt-28 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 id="hero-title" className="text-display font-medium">
              画完点位，报价就好了
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lead text-muted-foreground">
              在户型图上布好设备点位，系统按设备类型统计数量、匹配产品库型号，
              <br className="hidden sm:block" />
              几分钟出一份能直接交给客户的报价单。
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="h-11 rounded-full bg-foreground px-6 text-base text-background hover:bg-foreground/85">
                <Link href="/projects">
                  进入工作台
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              {data?.quote ? (
                <Button asChild size="lg" variant="outline" className="h-11 rounded-full px-6 text-base">
                  <Link href="#proposal">看方案与报价样张</Link>
                </Button>
              ) : null}
            </div>
          </div>
          {data && hasDemo ? (
            <div id="plan" className="mx-auto mt-16 max-w-7xl sm:mt-20">
              <PlanDemo data={data} />
              <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-muted-foreground">
                <span className="hidden md:inline">鼠标移到设备上看价签，</span>
                <span className="md:hidden">点按设备看价签，</span>
                点清单行在图上高亮同类设备，点图例隐藏某类设备。
              </p>
            </div>
          ) : null}
        </section>

        {data && company ? (
          <Section id="proposal" labelledBy="proposal-title" className="pt-28 sm:pt-36">
            <ProposalShowcase data={data} company={company} />
          </Section>
        ) : null}

        {data?.quote && company ? (
          <Section id="quote" labelledBy="quote-title" className="pt-28 sm:pt-36">
            <QuoteShowcase data={data} quote={data.quote} styles={DOC_STYLES} layouts={DOC_KINDS.quote.layouts} company={company} />
          </Section>
        ) : null}

        <DeliverySection total={data?.quote?.total ?? null} styles={DOC_STYLES} />
        {data ? <LibrarySection products={data.library.products} brands={data.library.brands} /> : null}
        <AppsSection />

        <section aria-labelledby="closing-title" className="border-t border-border/70 px-4 py-24 text-center sm:px-6 sm:py-32 lg:px-8">
          <h2 id="closing-title" className="mx-auto max-w-3xl text-headline font-medium">
            下一个项目，从一张户型图开始
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lead text-muted-foreground">账号由管理员在后台开通。新账号自带一份示例项目，可以直接在上面改点位、换型号、出报价。</p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="h-11 rounded-full bg-foreground px-6 text-base text-background hover:bg-foreground/85">
              <Link href="/projects">
                进入工作台
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 rounded-full px-6 text-base">
              <Link href="/login">登录</Link>
            </Button>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  )
}
