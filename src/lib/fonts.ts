import localFont from 'next/font/local'

/**
 * 全站拉丁字体：Inter 可变字体（Google Fonts v20 拉丁子集，自托管，约 73 KB）。
 * 带 opsz 光学尺寸轴：正文用 Text 字形，大标题自动切到 Display 字形（Linear 官网同款做法）。
 * 中文没有 Inter 字形，按 styles.css 里 --font-sans 的顺序落到苹方 / 冬青黑 / 微软雅黑 / 思源黑体。
 *
 * 注意变量名：next/font 用变量名当字族名。不能叫 inter——字族名不区分大小写，会和 styles.css 里
 * 文档模板用的远程 "Inter"（static.figma.com，400 KB+）撞名，浏览器会两份一起下载。
 */
export const siteSans = localFont({
  src: '../fonts/inter-latin-var.woff2',
  weight: '100 900',
  variable: '--font-inter',
  display: 'swap',
})
