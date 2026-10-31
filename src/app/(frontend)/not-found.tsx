import Link from 'next/link'
import { FileQuestion } from 'lucide-react'

import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <FileQuestion className="size-6" />
      </span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">页面不存在或无权访问</h1>
      <p className="mt-2 text-sm text-muted-foreground">你访问的项目、报价或页面可能已被删除，或当前账号没有访问权限。</p>
      <div className="mt-6 flex items-center gap-3">
        <Button asChild size="sm">
          <Link href="/projects">返回项目列表</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/">返回首页</Link>
        </Button>
      </div>
    </main>
  )
}
