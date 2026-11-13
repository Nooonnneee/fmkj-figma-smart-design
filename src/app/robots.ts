import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site-url'

/** 搜索引擎抓取规则：开放官网公开页，屏蔽工作台、后台与打印私有路径 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl()
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/catalog', '/download', '/brand'],
        disallow: [
          '/admin/',
          '/api/',
          '/mp/',
          '/auth/',
          '/print/',
          '/share/',
          '/projects/',
          '/quotes/',
          '/products/',
          '/capabilities/',
          '/membership/',
          '/settings/',
          '/ai/',
          '/join/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
