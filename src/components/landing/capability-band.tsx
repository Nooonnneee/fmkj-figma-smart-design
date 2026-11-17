import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Monitor, Package, Smartphone } from 'lucide-react'

import { brandSrc, LANDING_BRANDS } from './brand-logos'
import { Section } from './section'

/**
 * 能力带：把原来的产品库、桌面端、多端入口三段收成一条，
 * 每列只留一句事实和一个入口；品牌标识保留为一行可横向滑动的窄带。
 * #library、#desktop、#apps 三个旧锚点仍然可用。
 */
export function CapabilityBand({ products, brands }: { products: number; brands: number }) {
  const hasProducts = products > 0
  const libraryText = hasProducts
    ? `${products} 款在售产品、${brands} 个品牌，按平台和档次一键选好型号。`
    : '品牌产品库按平台和档次一键选好型号。'

  const items = [
    {
      icon: Package,
      title: '产品库',
      text: libraryText,
      href: '/catalog',
      cta: '浏览产品库',
      id: undefined,
    },
    {
      icon: Monitor,
      title: '桌面端',
      text: 'Windows 与 macOS 独立窗口，快捷键直达项目与打印。',
      href: '/download',
      cta: '下载客户端',
      id: 'desktop',
    },
    {
      icon: Smartphone,
      title: '多端同步',
      text: '手机小程序里看项目、改点位、发报价，三端实时同步。',
      href: '/login',
      cta: '手机扫码登录',
      id: 'apps',
    },
  ]

  return (
    <Section id="library" labelledBy="capability-title" className="pt-24 sm:pt-32">
      <h2 id="capability-title" className="text-headline font-medium">
        办公室用电脑，现场用手机
      </h2>

      <ul className="mt-12 grid gap-x-8 gap-y-10 border-t pt-10 sm:grid-cols-3">
        {items.map((item) => (
          <li key={item.title} id={item.id} className="scroll-mt-24">
            <item.icon aria-hidden className="size-5 text-muted-foreground" />
            <h3 className="mt-4 font-medium">{item.title}</h3>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {item.text}
            </p>
            <Link
              href={item.href}
              className="group mt-4 inline-flex w-fit items-center gap-1 rounded-sm text-sm font-medium"
            >
              {item.cta}
              <ArrowRight
                aria-hidden
                className="size-3.5 transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>

      <ul
        aria-label="产品库中的部分品牌"
        className="mt-12 flex items-center gap-8 overflow-x-auto border-t pt-8"
      >
        {LANDING_BRANDS.map((b) => (
          <li key={b.slug} className="flex h-8 shrink-0 items-center">
            <Image
              src={brandSrc(b.slug, 'color')}
              alt={b.name}
              width={b.width}
              height={b.height}
              unoptimized
              className="max-h-6 w-auto max-w-none object-contain opacity-70 grayscale transition duration-200 hover:opacity-100 hover:grayscale-0 dark:hidden"
            />
            <Image
              src={brandSrc(b.slug, 'mono')}
              alt={b.name}
              width={b.width}
              height={b.height}
              unoptimized
              className="hidden max-h-6 w-auto max-w-none object-contain opacity-70 transition-opacity hover:opacity-100 dark:block"
            />
          </li>
        ))}
      </ul>
    </Section>
  )
}
