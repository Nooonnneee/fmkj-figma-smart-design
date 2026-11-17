import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Monitor, Package, Smartphone } from 'lucide-react'

import { brandSrc, LANDING_BRANDS } from './brand-logos'
import { Section } from './section'

/**
 * 能力带：把原来的产品库、桌面端、多端入口三段收成一条，
 * 每列只留一句事实和必要入口；品牌标识在桌面端换行铺开，小屏横向滚动兜底。
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
      id: undefined,
      links: [{ href: '/catalog', label: '浏览产品库' }],
    },
    {
      icon: Monitor,
      title: '桌面端',
      text: 'Windows 与 macOS 独立窗口，快捷键直达项目与打印。',
      id: 'desktop',
      links: [{ href: '/download', label: '下载客户端' }],
    },
    {
      icon: Smartphone,
      title: '多端同步',
      text: '网页、桌面客户端、手机小程序三端实时同步，现场也能改点位、发报价。',
      id: 'apps',
      links: [
        { href: '/projects', label: '网页版 · 进入工作台' },
        { href: '/login', label: '手机扫码登录' },
      ],
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
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
              {item.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group inline-flex w-fit items-center gap-1 rounded-sm text-sm font-medium"
                >
                  {link.label}
                  <ArrowRight
                    aria-hidden
                    className="size-3.5 transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <ul
        aria-label="产品库中的部分品牌"
        className="mt-12 flex items-center gap-8 overflow-x-auto border-t pt-8 sm:grid sm:grid-cols-5 sm:gap-x-6 sm:gap-y-6 sm:overflow-visible lg:grid-cols-7"
      >
        {LANDING_BRANDS.map((b) => (
          <li key={b.slug} className="flex h-8 shrink-0 items-center justify-center">
            <Image
              src={brandSrc(b.slug, 'color')}
              alt={b.name}
              width={b.width}
              height={b.height}
              unoptimized
              className="max-h-6 w-auto max-w-full object-contain opacity-70 grayscale transition duration-200 hover:opacity-100 hover:grayscale-0 dark:hidden"
            />
            <Image
              src={brandSrc(b.slug, 'mono')}
              alt={b.name}
              width={b.width}
              height={b.height}
              unoptimized
              className="hidden max-h-6 w-auto max-w-full object-contain opacity-70 transition-opacity hover:opacity-100 dark:block"
            />
          </li>
        ))}
      </ul>
    </Section>
  )
}
