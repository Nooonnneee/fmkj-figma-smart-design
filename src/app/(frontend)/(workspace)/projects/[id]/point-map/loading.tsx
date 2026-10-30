import { Loader2 } from 'lucide-react'

export default function Loading() {
  return (
    <div className="full-bleed-page -mx-4 -mt-6 -mb-5 flex h-[calc(100svh-5.5rem)] items-center justify-center text-sm text-muted-foreground md:-mx-8 md:-mb-7 md:h-[calc(100svh-3rem)]">
      <Loader2 className="mr-2 size-4 animate-spin" />
      正在打开点位图…
    </div>
  )
}
