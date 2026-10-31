import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Download } from 'lucide-react'

import { BrandMark } from '@/components/brand/brand-mark'
import { Button } from '@/components/ui/button'
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE, COMPANY_NAME } from '@/lib/brand'

const NAV = [
  // 带上首页路径，品牌资源页等其他公开页面也能直接跳到首页对应板块
  { label: '点位图', href: '/#pointmap' },
  { label: '报价单', href: '/#quote' },
  { label: '工作流', href: '/#workflow' },
  { label: '更多能力', href: '/#features' },
]

/** 横版标识（白色字，深色背景用），文件见 public/brand */
function BrandLogo({ className }: { className?: string }) {
  return <Image src="/brand/fmkj-logo-white.svg" alt={APP_NAME} width={436} height={120} unoptimized priority className={className} />
}

/** 首页顶部导航：毛玻璃吸顶 */
export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label={`${APP_NAME} 首页`} className="flex shrink-0 items-center gap-2.5">
          <BrandLogo className="h-8 w-auto" />
          <span className="hidden border-l border-border pl-2.5 text-xs text-muted-foreground lg:inline">{APP_TAGLINE}</span>
        </Link>
        <nav aria-label="首页导航" className="hidden flex-1 items-center justify-center gap-1 md:flex">
          {NAV.map((item) => (
            <Button key={item.href} asChild variant="ghost" size="sm" className="text-muted-foreground">
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Button asChild variant="ghost" size="sm" className="hidden text-muted-foreground lg:inline-flex">
            <Link href="/download">
              <Download data-icon="inline-start" />
              下载客户端
            </Link>
          </Button>
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
        { label: '下载客户端', href: '/download' },
        { label: '品牌资源', href: '/brand' },
      ],
    },
    {
      title: '关于',
      links: [{ label: '品牌资源', href: '/brand' }],
    },
  ]
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-12 lg:px-8">
        <div className="md:col-span-6">
          <BrandLogo className="h-10 w-auto" />
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">{APP_DESCRIPTION}</p>
        </div>
        {groups.map((group) => (
          <nav key={group.title} aria-label={group.title} className="md:col-span-2">
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
            © {year} {COMPANY_NAME}
          </p>
          <p>文中品牌名称与标识归各自权利人所有</p>
        </div>
      </div>
    </footer>
  )
}
