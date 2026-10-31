import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { AppWindow, ArrowRight, Keyboard, Printer, RefreshCw, Server, ShieldCheck } from 'lucide-react'

import { DesktopHeroActions, DesktopPlatformCards } from '@/components/download/desktop-downloads'
import { LandingFooter, LandingNav } from '@/components/landing/landing-chrome'
import { SectionHeading } from '@/components/landing/section-heading'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { APP_NAME, pageTitle } from '@/lib/brand'

export const metadata: Metadata = {
  title: pageTitle('下载桌面客户端'),
  description: `${APP_NAME} Windows / macOS 桌面客户端：独立窗口、快捷键、打印导出和自动更新，登录一次长期有效。`,
}

const SHORTCUTS = [
  { keys: ['Ctrl', '1'], label: '项目' },
  { keys: ['Ctrl', '2'], label: '产品库' },
  { keys: ['Ctrl', 'P'], label: '打印' },
  { keys: ['Ctrl', 'N'], label: '新窗口' },
]

const FEATURES = [
  { icon: AppWindow, title: '独立窗口，专注工作', text: '不再和浏览器标签页混在一起。记住窗口大小和位置，下次打开直接回到上次的页面，也能同时开多个窗口对照方案。' },
  { icon: Keyboard, title: '常用操作有快捷键', text: '在项目、产品库之间快速切换，打印报价单、新开窗口都不用找按钮。macOS 上把 Ctrl 换成 ⌘。' },
  { icon: Printer, title: '打印和导出更顺手', text: '报价单、合同直接调用系统打印；导出文件时先选择保存位置，下载完成会通知，并能一键打开所在文件夹。' },
  { icon: RefreshCw, title: '自动更新，断网重连', text: 'Windows 版在后台下载新版本，重启即完成更新；macOS 版有新版本时及时提醒。网络中断时自动重试，恢复后回到原来的页面。' },
  { icon: ShieldCheck, title: '只连接你的服务器', text: '客户端只加载繁梦空间服务器上的页面，其它链接一律交给系统浏览器打开。在公用电脑上可以一键退出登录并清除本地数据。' },
  { icon: Server, title: '支持私有部署', text: '团队自建服务器时，在「帮助 → 服务器设置」里填写自己的地址即可，新版本也从你的服务器下发。' },
]

const INSTALL_STEPS = [
  {
    title: 'Windows',
    steps: ['双击安装程序，按提示选择安装位置。', '如果出现「Windows 已保护你的电脑」，点「更多信息」→「仍要运行」。', '安装完成后，从桌面或开始菜单打开「繁梦空间」。'],
  },
  {
    title: 'macOS',
    steps: ['打开下载的 DMG（或解压 ZIP），把「繁梦空间」拖进「应用程序」。', '首次打开如提示无法验证开发者：前往「系统设置 → 隐私与安全性」，点「仍要打开」。', '之后从启动台或程序坞直接打开即可。'],
  },
  {
    title: '网页安装版',
    steps: ['用 Chrome 或 Edge 打开网页版并登录。', '点地址栏右侧的「安装」图标，把繁梦空间添加为应用。', 'Safari 用户：在菜单栏选择「文件 → 添加到程序坞」。'],
  },
]

/** 下载页：Windows / macOS 桌面客户端与网页安装版 */
export default function DownloadPage() {
  return (
    <div data-landing className="dark relative min-h-svh overflow-x-clip bg-background text-foreground">
      <LandingNav />
      <main>
        <section aria-labelledby="download-title" className="relative isolate overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute inset-0 landing-grid landing-mask-radial opacity-60" />
            <div className="absolute -top-40 left-1/2 size-160 -translate-x-1/2 rounded-full bg-brand-indigo/25 blur-3xl" />
          </div>
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-20 pb-16 sm:px-6 sm:pt-28 lg:grid-cols-2 lg:px-8">
            <div>
              <Badge variant="outline" className="h-7 rounded-full bg-card/60 px-3 text-muted-foreground">
                桌面客户端 · Windows / macOS
              </Badge>
              <h1 id="download-title" className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                把{APP_NAME}装进你的电脑
              </h1>
              <p className="mt-5 max-w-xl text-base text-pretty text-muted-foreground sm:text-lg">
                独立窗口打开工作台，设计、报价、合同一气呵成。登录一次长期有效，新版本自动送达。
              </p>
              <DesktopHeroActions />
            </div>

            <div aria-hidden className="relative mx-auto w-full max-w-lg">
              <div className="absolute -inset-8 -z-10 rounded-full bg-brand-violet/20 blur-3xl" />
              <div className="overflow-hidden rounded-2xl border border-border bg-card/70 shadow-2xl backdrop-blur">
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <span className="size-2.5 rounded-full bg-muted-foreground/40" />
                  <span className="size-2.5 rounded-full bg-muted-foreground/40" />
                  <span className="size-2.5 rounded-full bg-muted-foreground/40" />
                  <span className="ml-3 text-xs text-muted-foreground">{APP_NAME}</span>
                </div>
                <div className="grid grid-cols-4">
                  <div className="col-span-1 space-y-3 border-r border-border p-4">
                    <div className="h-2 w-3/4 rounded-full bg-primary/60" />
                    <div className="h-2 w-2/3 rounded-full bg-muted" />
                    <div className="h-2 w-1/2 rounded-full bg-muted" />
                    <div className="h-2 w-2/3 rounded-full bg-muted" />
                  </div>
                  <div className="col-span-3 flex flex-col items-center gap-5 p-8">
                    <Image src="/brand/fmkj-app-icon-512.png" alt="" width={512} height={512} unoptimized className="size-28 drop-shadow-2xl" />
                    <div className="grid w-full grid-cols-3 gap-2">
                      <div className="h-12 rounded-lg bg-muted/70" />
                      <div className="h-12 rounded-lg bg-muted/70" />
                      <div className="h-12 rounded-lg bg-brand-indigo/20" />
                    </div>
                    <div className="h-2 w-2/3 rounded-full bg-muted" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="platforms" aria-labelledby="platforms-title" className="scroll-mt-20 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading id="platforms-title" eyebrow="选择你的平台" title="一个账号，所有电脑通用" description="客户端连接同一个繁梦空间服务器，项目、报价和合同实时同步，网页版和小程序里的数据也一样。" />
            <DesktopPlatformCards />
          </div>
        </section>

        <section aria-labelledby="features-title" className="py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading id="features-title" eyebrow="为桌面而生" title="比浏览器更顺手的工作台" />
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="rounded-2xl border border-border bg-card/50 p-6">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-brand-indigo/15 text-primary">
                    <feature.icon className="size-5" />
                  </span>
                  <h3 className="mt-5 text-base font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{feature.text}</p>
                  {feature.icon === Keyboard ? (
                    <ul className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      {SHORTCUTS.map((shortcut) => (
                        <li key={shortcut.label} className="flex items-center gap-2">
                          <KbdGroup>
                            {shortcut.keys.map((key) => (
                              <Kbd key={key}>{key}</Kbd>
                            ))}
                          </KbdGroup>
                          {shortcut.label}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="install-title" className="py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeading id="install-title" eyebrow="安装说明" title="三步装好，马上开工" description="客户端暂未购买系统代码签名证书，首次安装时系统可能会提示风险，按下面的步骤确认即可。" />
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {INSTALL_STEPS.map((group) => (
                <div key={group.title} className="rounded-2xl border border-border bg-card/50 p-6">
                  <h3 className="text-base font-semibold">{group.title}</h3>
                  <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
                    {group.steps.map((step, index) => (
                      <li key={step} className="flex gap-3">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground tabular-nums">{index + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="rounded-full">
                <Link href="/projects">
                  先用网页版
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <Link href="/login">登录账号</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  )
}
