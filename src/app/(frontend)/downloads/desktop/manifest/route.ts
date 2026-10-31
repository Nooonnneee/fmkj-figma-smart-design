import { getDesktopReleases } from '@/lib/desktop-releases'

// 每次请求实时读取安装包目录（上传新版本后无需重新部署网站）
export const dynamic = 'force-dynamic'

/** 当前发布的桌面客户端版本：下载页展示，客户端「服务器设置 → 测试连接」也用它确认服务器。 */
export async function GET() {
  return Response.json(await getDesktopReleases(), { headers: { 'Cache-Control': 'no-store' } })
}
