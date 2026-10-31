import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE, brandInitials } from '@/lib/brand'

const NAV = [
  { label: '点位图', href: '#pointmap' },
  { label: '报价单', href: '#quote' },
  { label: '工作流', href: '#workflow' },
  { label: '更多能力', href: '#features' },
]

function BrandMark() {
  return (
    <span aria-hidden className="flex size-8 items-center justify-center rounded-lg bg-linear-to-br from-chart-1 to-chart-4 text-xs font-bold tracking-tight text-foreground shadow-lg">
      {brandInitials(APP_NAME)}
    </span>
  )
}

/** 首页顶部导航：毛玻璃吸顶 */
export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label={`${APP_NAME} 首页`} className="flex shrink-0 items-center gap-2.5">
          <BrandMark />
          <span className="text-base font-semibold tracking-tight">{APP_NAME}</span>
          <span className="hidden text-xs text-muted-foreground lg:inline">{APP_TAGLINE}</span>
        </Link>
        <nav aria-label="首页导航" className="hidden flex-1 items-center justify-center gap-1 md:flex">
          {NAV.map((item) => (
            <Button key={item.href} asChild variant="ghost" size="sm" className="text-muted-foreground">
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">登录</Link>
          </Button>
          <Button asChild size="sm" className="rounded-full px-4">
            <Link href="/projects">
              进入工作台
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  )
}

export function LandingFooter() {
  const year = new Date().getFullYear()
  const groups = [
    { title: '产品', links: NAV },
    {
      title: '开始使用',
      links: [
        { label: '登录账号', href: '/login' },
        { label: '进入工作台', href: '/projects' },
      ],
    },
  ]
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-12 lg:px-8">
        <div className="md:col-span-6">
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <span className="text-base font-semibold tracking-tight">{APP_NAME}</span>
            <span className="text-xs text-muted-foreground">{APP_TAGLINE}</span>
          </div>
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">{APP_DESCRIPTION}</p>
        </div>
        {groups.map((group) => (
          <nav key={group.title} aria-label={group.title} className="md:col-span-3">
            <h3 className="text-sm font-medium">{group.title}</h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-muted-foreground transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-muted-foreground sm:px-6 lg:px-8">
          <p>
            © {year} {APP_NAME} · {APP_TAGLINE}
          </p>
          <p>文中品牌名称与标识归各自权利人所有</p>
        </div>
      </div>
    </footer>
  )
}
