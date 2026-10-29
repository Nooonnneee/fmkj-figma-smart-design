import Image from 'next/image'

import { deviceTypeLabel, isDeviceType } from '@/lib/device-types'
import { markerUrl } from '@/lib/point-markers'
import { cn } from '@/lib/utils'

/** 点位标记图标：和点位图画布、方案图例上的图标完全一致。 */
export function PointMarker({ type, className, title }: { type: string | null | undefined; className?: string; title?: boolean }) {
  const t = isDeviceType(type) ? type : 'other'
  return (
    <Image
      src={markerUrl(t)}
      alt={title ? deviceTypeLabel(t) : ''}
      width={64}
      height={64}
      unoptimized
      draggable={false}
      className={cn('size-6 shrink-0 select-none', className)}
    />
  )
}
