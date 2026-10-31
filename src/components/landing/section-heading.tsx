import { cn } from '@/lib/utils'

/** 分区眉标：小圆点 + 短标签 */
export function SectionEyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur', className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-chart-1" />
      {children}
    </p>
  )
}

/** 分区标题：眉标 + 大标题 + 说明 */
export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = 'center',
  className,
}: {
  id?: string
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  align?: 'center' | 'left'
  className?: string
}) {
  return (
    <div className={cn('max-w-3xl', align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow ? <SectionEyebrow>{eyebrow}</SectionEyebrow> : null}
      <h2 id={id} className="mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {description ? <p className="mt-5 text-base text-pretty text-muted-foreground sm:text-lg">{description}</p> : null}
    </div>
  )
}
