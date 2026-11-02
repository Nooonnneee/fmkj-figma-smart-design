import { randomBytes } from 'node:crypto'
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

const EXPORT_DIR = '/tmp/fmkj-exports'
const TTL_MS = 30 * 60 * 1000

function safeId(raw: string | null): string | null {
  if (!raw || !/^[a-f0-9]{24}$/.test(raw)) return null
  return raw
}

function safeFileName(raw: string | null): string {
  const cleaned = (raw ?? 'document.pdf').replace(/[\\/:*?"<>|\r\n]+/g, '-').trim()
  return cleaned.endsWith('.pdf') ? cleaned : `${cleaned || 'document'}.pdf`
}

async function cleanupExpired() {
  try {
    const files = await readdir(EXPORT_DIR)
    const now = Date.now()
    await Promise.all(
      files.map(async (f) => {
        const full = path.join(EXPORT_DIR, f)
        const st = await stat(full).catch(() => null)
        if (st && now - st.mtimeMs > TTL_MS) {
          await unlink(full).catch(() => null)
        }
      }),
    )
  } catch {
    // ignore cleanup errors
  }
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const fileName = safeFileName(url.searchParams.get('name'))
    const buf = Buffer.from(await request.arrayBuffer())
    if (buf.byteLength === 0 || buf.byteLength > 40 * 1024 * 1024) {
      return Response.json({ ok: false, error: '文件大小超出限制' }, { status: 400 })
    }
    await mkdir(EXPORT_DIR, { recursive: true })
    void cleanupExpired()
    const id = randomBytes(12).toString('hex')
    await writeFile(path.join(EXPORT_DIR, `${id}.pdf`), buf)
    const downloadPath = `/print/export-file?id=${id}&name=${encodeURIComponent(fileName)}`
    return Response.json({
      ok: true,
      id,
      url: downloadPath,
      previewUrl: `${downloadPath}&inline=1`,
    })
  } catch {
    return Response.json({ ok: false, error: '保存导出文件失败' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const id = safeId(url.searchParams.get('id'))
  const fileName = safeFileName(url.searchParams.get('name'))
  const inline = url.searchParams.get('inline') === '1'
  if (!id) {
    return new Response('链接无效或已过期，请返回重新导出。', { status: 404 })
  }
  const filePath = path.join(EXPORT_DIR, `${id}.pdf`)
  const bytes = await readFile(filePath).catch(() => null)
  if (!bytes) {
    return new Response('导出文件已过期（保留 30 分钟），请返回页面重新点击导出。', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
  const asciiFallback = fileName.replace(/[^\x20-\x7E]/g, '_')
  const disposition = `${inline ? 'inline' : 'attachment'}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': disposition,
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'private, max-age=1800',
    },
  })
}
