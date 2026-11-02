import type { Metadata } from 'next'

import NotFound from './(frontend)/not-found'
import './(frontend)/styles.css'

/**
 * 没有任何路由匹配的网址（项目里有前台和后台两套根布局，无法组合出统一的 404），
 * 直接返回这个完整页面；内容与前台的「页面不存在」一致。
 */
export const metadata: Metadata = {
  title: '页面不存在',
  description: '你访问的页面不存在或已被删除。',
}

export default function GlobalNotFound() {
  return (
    <html lang="zh-CN">
      <body className="bg-background text-foreground antialiased">
        <NotFound />
      </body>
    </html>
  )
}
