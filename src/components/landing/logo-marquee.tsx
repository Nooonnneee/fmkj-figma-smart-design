import Image from 'next/image'
import { Bluetooth, Cable, Cpu, Hexagon, House, Layers, Lightbulb, Network, PlugZap, Radio, Smartphone, Sparkles, Waypoints, Wifi, Zap, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

import { brandSrc, LANDING_BRANDS, type LandingBrand } from './brand-logos'

/** 通信协议与智能生态（文字 + 图标，不使用第三方协议商标图形） */
const PROTOCOLS: { name: string; icon: LucideIcon }[] = [
  { name: 'Matter', icon: Hexagon },
  { name: 'Thread', icon: Waypoints },
  { name: 'Zigbee 3.0', icon: Radio },
  { name: 'Wi-Fi 7', icon: Wifi },
  { name: '蓝牙 Mesh', icon: Bluetooth },
  { name: 'KNX', icon: Network },
  { name: 'PLC 电力载波', icon: Zap },
  { name: 'RS485 / Modbus', icon: Cable },
  { name: 'DALI 调光', icon: Lightbulb },
  { name: 'PoE 供电', icon: PlugZap },
  { name: 'Apple Home', icon: House },
  { name: '米家', icon: Smartphone },
  { name: '华为鸿蒙智家', icon: Sparkles },
  { name: 'Aqara Home', icon: Layers },
  { name: 'Control4', icon: Cpu },
]
const TONES = ['text-chart-1', 'text-chart-2', 'text-chart-3', 'text-chart-4', 'text-chart-5']

const half = Math.ceil(LANDING_BRANDS.length / 2)
const ROW_A = LANDING_BRANDS.slice(0, half)
const ROW_B = LANDING_BRANDS.slice(half)

/** 三行无缝滚动：品牌 → 协议（反向）→ 品牌。悬停暂停，品牌悬停显示原色。 */
export function LogoMarquee() {
  return (
    <section aria-labelledby="ecosystem-title" className="relative py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <h2 id="ecosystem-title" className="text-sm font-medium text-muted-foreground">
          兼容主流品牌、生态与通信协议，选型不被单一品牌绑定
        </h2>
      </div>
      <div className="mt-10 space-y-4">
        <MarqueeRow label="兼容品牌（一）" className="[--marquee-duration:80s]">
          {(hidden) => <BrandSet brands={ROW_A} hidden={hidden} />}
        </MarqueeRow>
        <MarqueeRow label="生态与通信协议" reverse className="[--marquee-duration:70s]">
          {(hidden) => <ProtocolSet hidden={hidden} />}
        </MarqueeRow>
        <MarqueeRow label="兼容品牌（二）" className="[--marquee-duration:90s]">
          {(hidden) => <BrandSet brands={ROW_B} hidden={hidden} />}
        </MarqueeRow>
      </div>
    </section>
  )
}

/** 两份相同的列表首尾相接，各自平移 -100%，形成无缝循环；第二份只作视觉延续，对读屏隐藏 */
function MarqueeRow({ label, reverse = false, className, children }: { label: string; reverse?: boolean; className?: string; children: (hidden: boolean) => React.ReactNode }) {
  return (
    <div className={cn('group/marquee flex overflow-hidden landing-mask-x motion-reduce:[mask-image:none]', className)}>
      {[false, true].map((hidden) => (
        <ul
          key={String(hidden)}
          aria-label={hidden ? undefined : label}
          aria-hidden={hidden || undefined}
          className={cn(
            'flex min-w-max shrink-0 items-center gap-4 pr-4 motion-safe:animate-marquee group-hover/marquee:[animation-play-state:paused]',
            reverse && '[animation-direction:reverse]',
            hidden ? 'motion-reduce:hidden' : 'motion-reduce:min-w-0 motion-reduce:flex-1 motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:px-4',
          )}
        >
          {children(hidden)}
        </ul>
      ))}
    </div>
  )
}

function BrandSet({ brands, hidden }: { brands: LandingBrand[]; hidden: boolean }) {
  return brands.map((brand, i) => <LogoChip key={`${brand.slug}-${i}`} brand={brand} hidden={hidden} duplicate={false} />)
}

function LogoChip({ brand, hidden, duplicate }: { brand: LandingBrand; hidden: boolean; duplicate: boolean }) {
  const ratio = brand.width / brand.height
  const height = ratio < 1.6 ? 'h-9' : ratio < 3.6 ? 'h-7' : 'h-6'
  const silent = hidden || duplicate
  return (
    <li
      aria-hidden={silent || undefined}
      className={cn(
        'group/logo relative flex h-16 shrink-0 items-center rounded-2xl border border-border bg-card/40 px-6 transition-colors duration-300 hover:border-transparent hover:bg-foreground',
        duplicate && 'motion-reduce:hidden',
      )}
    >
      <Image
        src={brandSrc(brand.slug, 'mono')}
        alt={silent ? '' : brand.name}
        title={brand.name}
        width={brand.width}
        height={brand.height}
        unoptimized
        className={cn(height, 'w-auto opacity-70 transition-opacity duration-300 group-hover/logo:opacity-0')}
      />
      <Image
        src={brandSrc(brand.slug, 'color')}
        alt=""
        width={brand.width}
        height={brand.height}
        unoptimized
        className={cn(height, 'absolute top-1/2 left-6 w-auto -translate-y-1/2 opacity-0 transition-opacity duration-300 group-hover/logo:opacity-100')}
      />
    </li>
  )
}

function ProtocolSet({ hidden }: { hidden: boolean }) {
  return [...PROTOCOLS, ...PROTOCOLS].map(({ name, icon: Icon }, i) => {
    const duplicate = i >= PROTOCOLS.length
    return (
      <li
        key={`${name}-${i}`}
        aria-hidden={hidden || duplicate || undefined}
        className={cn(
          'flex h-12 shrink-0 items-center gap-2 rounded-full border border-border bg-card/40 px-5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground',
          duplicate && 'motion-reduce:hidden',
        )}
      >
        <Icon className={cn('size-4', TONES[i % TONES.length])} />
        {name}
      </li>
    )
  })
}
