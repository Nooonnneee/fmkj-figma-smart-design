import Image from 'next/image'

import { cn } from '@/lib/utils'

import { brandSrc, LANDING_BRANDS, type LandingBrand } from './brand-logos'

/** 智能平台与通信协议：仅展示官方单图标，不配文字 */
type EcoItem = { name: string; logo: string; w: number; h: number }

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
]

const half = Math.ceil(LANDING_BRANDS.length / 2)
const ROW_A = LANDING_BRANDS.slice(0, half)
const ROW_B = LANDING_BRANDS.slice(half)

/** 四行无缝滚动：品牌 → 平台 → 协议 → 品牌，方向交替，悬停暂停。图标始终显示官方原色。 */
export function LogoMarquee() {
  return (
    <section aria-labelledby="ecosystem-title" className="relative py-14 sm:py-18">
      <h2 id="ecosystem-title" className="sr-only">
        兼容主流品牌、生态与通信协议
      </h2>
      <div className="space-y-4">
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
        'relative flex h-16 w-40 shrink-0 items-center justify-center rounded-2xl bg-white px-6 shadow-sm ring-1 ring-black/5',
        duplicate && 'motion-reduce:hidden',
      )}
    >
      <Image
        src={brandSrc(brand.slug, 'color')}
        alt={silent ? '' : brand.name}
        title={brand.name}
        width={brand.width}
        height={brand.height}
        unoptimized
        className={cn(height, 'w-auto max-w-28 object-contain')}
      />
    </li>
  )
}

/** 与品牌卡片同一样式：浅底卡片 + 官方原色图标 */
function EcoSet({ items, hidden }: { items: EcoItem[]; hidden: boolean }) {
  return items.map(({ name, logo, w, h }) => {
    const ratio = w / h
    const height = ratio < 1.6 ? 'h-9' : ratio < 3.6 ? 'h-7' : 'h-6'
    return (
      <li
        key={name}
        aria-hidden={hidden || undefined}
        className="relative flex h-16 w-40 shrink-0 items-center justify-center rounded-2xl bg-white px-6 shadow-sm ring-1 ring-black/5"
      >
        <Image
          src={`/ecosystem/${logo}`}
          alt={hidden ? '' : name}
          title={name}
          width={w}
          height={h}
          unoptimized
          className={cn(height, 'w-auto max-w-28 object-contain')}
        />
      </li>
    )
  })
}
