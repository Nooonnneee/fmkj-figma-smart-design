import type { MetadataRoute } from 'next'

import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE } from '@/lib/brand'

/** 网页安装版（PWA）：Chrome / Edge 可把网页版安装为桌面应用 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: `${APP_NAME} · ${APP_TAGLINE}`,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    lang: 'zh-CN',
    start_url: '/projects',
    scope: '/',
    display: 'standalone',
    background_color: '#0B0C1E',
    theme_color: '#0B0C1E',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/brand/fmkj-app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/fmkj-app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
