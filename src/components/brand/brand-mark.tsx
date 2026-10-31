import Image from 'next/image'

import { APP_NAME, APP_NAME_EN } from '@/lib/brand'
import { cn } from '@/lib/utils'

/** 繁梦空间标志：房屋（空间）+ 新月（梦）+ 星光（繁 · 智能）。 */
export function BrandMark({ className, decorative = false, priority = false }: { className?: string; decorative?: boolean; priority?: boolean }) {
  return (
    <Image
      src="/brand/fmkj-mark.svg"
      alt={decorative ? '' : APP_NAME}
      width={64}
      height={64}
      unoptimized
      priority={priority}
      draggable={false}
      className={cn('size-8 shrink-0 select-none', className)}
    />
  )
}

/** 标志 + 中英文字标（界面内使用，文字跟随主题颜色）。 */
export function BrandLockup({ className, markClassName, subtitle }: { className?: string; markClassName?: string; subtitle?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BrandMark decorative className={markClassName} />
      <span className="grid leading-tight">
        <span className="text-base font-semibold tracking-wide">{APP_NAME}</span>
        <span className="text-xs tracking-widest text-muted-foreground uppercase">{subtitle ?? APP_NAME_EN}</span>
      </span>
    </span>
  )
}
