import { redirect } from 'next/navigation'

/**
 * AI 会话不再做独立整页：统一走页面右侧常驻栏。
 * 这里保留路由并重定向到 /projects，避免帮助手册、收藏夹、旧插件页里的
 * `/ai` 链接 404；AI 生图等工具页（/ai/image、/ai/image/style）不受影响。
 */
export default function AiPage() {
  redirect('/projects')
}
