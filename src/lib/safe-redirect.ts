/**
 * 站内跳转地址校验：只接受以单个「/」开头的相对路径。
 * 拒绝「//」「/\」（浏览器会当成跳到别的网站）、反斜杠和控制字符，防止登录后被带到外部网站（开放重定向）。
 */
export function safeRedirectPath(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback
  return value
}
