import Image from 'next/image'
import { Cable, Cpu, PlugZap, Zap, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

import { brandSrc, LANDING_BRANDS, type LandingBrand } from './brand-logos'

/** 智能平台与通信协议：有官方标识的显示图标（放在浅色小底板上保证深色背景下可见），无标识的用线性图标 */
type EcoItem = { name: string; logo?: string; w?: number; h?: number; icon?: LucideIcon }

const PLATFORMS: EcoItem[] = [
  { name: 'Apple Home', logo: 'apple-home.svg', w: 512, h: 512 },
  { name: '米家', logo: 'mijia.webp', w: 96, h: 96 },
  { name: '华为鸿蒙智家', logo: 'harmonyos.svg', w: 24, h: 24 },
  { name: 'Google Home', logo: 'google-home.svg', w: 256, h: 258 },
  { name: 'Amazon Alexa', logo: 'alexa.svg', w: 24, h: 24 },
  { name: 'SmartThings', logo: 'smartthings.svg', w: 24, h: 24 },
  { name: 'Home Assistant', logo: 'home-assistant.svg', w: 24, h: 24 },
  { name: 'Aqara Home', logo: 'aqara-home.svg', w: 80, h: 48 },
  { name: '涂鸦智能', logo: 'tuya-smart.svg', w: 60, h: 30 },
  { name: '天猫精灵', logo: 'tmall-genie.webp', w: 969, h: 96 },
  { name: '小度', logo: 'xiaodu.svg', w: 48, h: 48 },
  { name: 'Control4', icon: Cpu },
]

const PROTOCOLS: EcoItem[] = [
  { name: 'Matter', logo: 'matter.svg', w: 512, h: 110 },
  { name: 'Thread', logo: 'thread.svg', w: 165, h: 165 },
  { name: 'Zigbee 3.0', logo: 'zigbee.svg', w: 256, h: 256 },
  { name: 'Wi-Fi', logo: 'wifi.svg', w: 256, h: 192 },
  { name: '蓝牙', logo: 'bluetooth.svg', w: 256, h: 348 },
  { name: '蓝牙 Mesh', logo: 'ble-mesh.svg', w: 360, h: 160 },
  { name: 'Z-Wave', logo: 'zwave.svg', w: 256, h: 114 },
  { name: 'KNX', logo: 'knx.svg', w: 114, h: 53 },
  { name: 'DALI 调光', logo: 'dali.webp', w: 202, h: 96 },
  { name: 'Modbus', logo: 'modbus.webp', w: 282, h: 96 },
  { name: 'MQTT', logo: 'mqtt.svg', w: 24, h: 24 },
  { name: '以太网', logo: 'ethernet.svg', w: 24, h: 24 },
  { name: 'PLC 电力载波', icon: Zap },
  { name: 'RS485', icon: Cable },
  { name: 'PoE 供电', icon: PlugZap },
]
const TONES = ['text-chart-1', 'text-chart-2', 'text-chart-3', 'text-chart-4', 'text-chart-5']

const half = Math.ceil(LANDING_BRANDS.length / 2)
const ROW_A = LANDING_BRANDS.slice(0, half)
const ROW_B = LANDING_BRANDS.slice(half)

/** 四行无缝滚动：品牌 → 平台 → 协议 → 品牌，方向交替。悬停暂停，品牌悬停显示原色。 */
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
        <MarqueeRow label="智能平台" reverse className="[--marquee-duration:70s]">
          {(hidden) => <EcoSet items={PLATFORMS} hidden={hidden} />}
        </MarqueeRow>
        <MarqueeRow label="通信协议" className="[--marquee-duration:75s]">
          {(hidden) => <EcoSet items={PROTOCOLS} hidden={hidden} />}
        </MarqueeRow>
        <MarqueeRow label="兼容品牌（二）" reverse className="[--marquee-duration:90s]">
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

function EcoSet({ items, hidden }: { items: EcoItem[]; hidden: boolean }) {
  return items.map(({ name, logo, w = 1, h = 1, icon: Icon }, i) => (
    <li
      key={name}
      className="flex h-12 shrink-0 items-center gap-2.5 rounded-full border border-border bg-card/40 py-1.5 pr-5 pl-1.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
    >
      <span className="flex h-full min-w-9 items-center justify-center rounded-full bg-white px-2.5">
        {logo ? (
          <Image src={`/ecosystem/${logo}`} alt="" width={w} height={h} unoptimized className={cn('w-auto', w / h > 2.2 ? 'h-3.5 max-w-24' : 'h-5')} />
        ) : Icon ? (
          <Icon className={cn('size-4', TONES[i % TONES.length])} />
        ) : null}
      </span>
      <span aria-hidden={hidden || undefined}>{name}</span>
    </li>
  ))
}
