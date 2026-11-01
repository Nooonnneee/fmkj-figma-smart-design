/**
 * 在浏览器内把页面直接生成标准 A4 PDF 文件并下载（不依赖 window.print，在预览 iframe 里也能直接导出）。
 *
 * - 方案页（多张横向 A4 卡片）：每张卡片一页横向 A4（841.89 × 595.28 pt）；
 * - 报价单（纵向 A4 长文）：按 A4 比例自动分页，并在切页位置向上寻找空白行，避免把文字或图片截断。
 */

type PageJpeg = { bytes: Uint8Array; widthPx: number; heightPx: number; widthPt: number; heightPt: number }

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(',')[1] ?? ''
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

type Rgb = [number, number, number]

/** 纸张底色：取画布左上角（页边距内）的颜色。暖白、燕麦等有底色的风格也能正确识别空白行 */
function paperColor(ctx: CanvasRenderingContext2D): Rgb {
  const d = ctx.getImageData(4, 4, 1, 1).data
  return [d[0], d[1], d[2]]
}

/** 像素和纸张底色是否明显不同（文字、线条、图片） */
const inked = (data: Uint8ClampedArray, i: number, bg: Rgb) => Math.abs(data[i] - bg[0]) > 13 || Math.abs(data[i + 1] - bg[1]) > 13 || Math.abs(data[i + 2] - bg[2]) > 13

/** 在 targetY 往上找一整行几乎只有纸色的位置切页，避免截断文字或表格边线 */
function findSafeCutY(ctx: CanvasRenderingContext2D, width: number, targetY: number, minY: number, bg: Rgb): number {
  const searchH = Math.min(180, targetY - minY)
  if (searchH <= 8) return targetY
  const startY = targetY - searchH
  const data = ctx.getImageData(0, startY, width, searchH).data
  const marginX = Math.floor(width * 0.04)
  for (let row = searchH - 1; row >= 0; row--) {
    let dark = 0
    const rowOffset = row * width * 4
    for (let x = marginX; x < width - marginX; x += 2) {
      const i = rowOffset + x * 4
      if (inked(data, i, bg)) {
        dark++
        if (dark > 3) break
      }
    }
    if (dark === 0) return startY + row
  }
  return targetY
}

/** 读取页面内不可从中间切断的块（点位图、房间卡片、表格行、页脚等）在画布上的纵向范围 */
function collectAtomicBlocks(root: HTMLElement, scale: number): { top: number; bottom: number }[] {
  const rootRect = root.getBoundingClientRect()
  const blocks: { top: number; bottom: number }[] = []
  for (const el of root.querySelectorAll<HTMLElement>('[data-pdf-block], .break-inside-avoid, tr, header, footer')) {
    const r = el.getBoundingClientRect()
    if (r.height <= 0) continue
    blocks.push({
      top: Math.max(0, Math.floor((r.top - rootRect.top) * scale)),
      bottom: Math.ceil((r.bottom - rootRect.top) * scale),
    })
  }
  // 标题与紧跟它的下一块保持在同一页，避免标题单独留在页底
  for (const el of root.querySelectorAll<HTMLElement>('[data-pdf-keep-next]')) {
    const r = el.getBoundingClientRect()
    if (r.height <= 0) continue
    const top = Math.max(0, Math.floor((r.top - rootRect.top) * scale))
    const bottom = Math.ceil((r.bottom - rootRect.top) * scale) + Math.round(140 * scale)
    blocks.push({ top, bottom })
  }
  // 文档末尾的 footer 与它上方的签字栏保持在同一页，防止最后一页只剩单独一行页脚
  const footerEl = root.querySelector<HTMLElement>('footer')
  if (footerEl) {
    const fr = footerEl.getBoundingClientRect()
    if (fr.height > 0) {
      const fBottom = Math.ceil((fr.bottom - rootRect.top) * scale)
      const fTop = Math.max(0, Math.floor((fr.top - rootRect.top) * scale) - Math.round(140 * scale))
      blocks.push({ top: fTop, bottom: fBottom })
    }
  }
  return blocks.sort((a, b) => a.top - b.top)
}

/** 强制从新的一页开始的位置（例如合同的附件），标记为 data-pdf-break-before */
function collectBreaks(root: HTMLElement, scale: number): number[] {
  const rootRect = root.getBoundingClientRect()
  return [...root.querySelectorAll<HTMLElement>('[data-pdf-break-before]')]
    .map((el) => Math.floor((el.getBoundingClientRect().top - rootRect.top) * scale) - Math.round(4 * scale))
    .filter((n) => n > 0)
    .sort((a, b) => a - b)
}

function isStripMostlyBlank(ctx: CanvasRenderingContext2D, width: number, startY: number, endY: number, bg: Rgb): boolean {
  const h = endY - startY
  if (h <= 0) return true
  const data = ctx.getImageData(0, startY, width, h).data
  const marginX = Math.floor(width * 0.04)
  let darkPixels = 0
  for (let row = 0; row < h; row += 2) {
    const rowOffset = row * width * 4
    for (let x = marginX; x < width - marginX; x += 4) {
      const i = rowOffset + x * 4
      if (inked(data, i, bg)) {
        darkPixels++
        if (darkPixels > 12) return false
      }
    }
  }
  return true
}

/** 把纵向长画布按 A4 比例切成多页 A4 画布（按 DOM 块边界切页，不劈开卡片、点位图或表格行） */
function slicePortraitCanvas(source: HTMLCanvasElement, domEl: HTMLElement, scale: number): PageJpeg[] {
  const W_PT = 595.28
  const H_PT = 841.89
  const fullPageH = Math.round(source.width * (H_PT / W_PT))
  const padY = Math.round(fullPageH * 0.035)
  const contentH = fullPageH - padY * 2
  const srcCtx = source.getContext('2d', { willReadFrequently: true })!
  const bg = paperColor(srcCtx)
  const blocks = collectAtomicBlocks(domEl, scale)
  const breaks = collectBreaks(domEl, scale)

  const pages: PageJpeg[] = []
  let y = 0
  while (y < source.height - 8) {
    if (pages.length > 0 && isStripMostlyBlank(srcCtx, source.width, y, source.height, bg)) {
      break
    }
    const isFirst = y === 0
    const maxSlice = isFirst ? fullPageH - padY : contentH
    let nextY = y + maxSlice
    const forced = breaks.find((b) => b > y + 8 && b <= Math.min(nextY, source.height))
    if (forced !== undefined) {
      nextY = forced
    } else if (nextY >= source.height - 16) {
      nextY = source.height
    } else {
      const minCut = y + Math.floor(maxSlice * 0.35)
      // 只要切线压在某个原子块内部，就把切线移到该块上方
      let changed = true
      while (changed) {
        changed = false
        for (const b of blocks) {
          if (b.top > minCut && b.top < nextY && b.bottom > nextY) {
            nextY = Math.max(minCut, b.top - Math.round(6 * scale))
            changed = true
          }
        }
      }
      nextY = findSafeCutY(srcCtx, source.width, nextY, Math.max(minCut, nextY - Math.round(48 * scale)), bg)
    }
    const sliceH = Math.max(1, nextY - y)
    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = source.width
    pageCanvas.height = fullPageH
    const pCtx = pageCanvas.getContext('2d')!
    // 续页上下留白用纸张底色填充，有底色的风格不会出现白边
    pCtx.fillStyle = `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`
    pCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
    pCtx.drawImage(source, 0, y, source.width, sliceH, 0, isFirst ? 0 : padY, source.width, sliceH)
    pages.push({
      bytes: dataUrlToBytes(pageCanvas.toDataURL('image/jpeg', 0.92)),
      widthPx: pageCanvas.width,
      heightPx: pageCanvas.height,
      widthPt: W_PT,
      heightPt: H_PT,
    })
    y = nextY
  }
  return pages
}

/** 把多页 JPEG 组装成标准 PDF 1.4 二进制文件 */
function buildPdfFromJpegs(pages: PageJpeg[]): Blob {
  const enc = new TextEncoder()
  const chunks: Uint8Array[] = []
  const offsets: number[] = [0]
  let length = 0

  const pushStr = (s: string) => {
    const b = enc.encode(s)
    chunks.push(b)
    length += b.byteLength
  }
  const pushBytes = (b: Uint8Array) => {
    chunks.push(b)
    length += b.byteLength
  }
  const startObj = (id: number) => {
    offsets[id] = length
    pushStr(`${id} 0 obj\n`)
  }
  const endObj = () => pushStr('\nendobj\n')

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n')

  // 1: Catalog, 2: Pages
  // 每页占 3 个对象：pageId = 3 + i*3, contentId = 4 + i*3, imgId = 5 + i*3
  const pageIds = pages.map((_, i) => 3 + i * 3)

  startObj(1)
  pushStr('<< /Type /Catalog /Pages 2 0 R >>')
  endObj()

  startObj(2)
  pushStr(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`)
  endObj()

  pages.forEach((p, i) => {
    const pageId = 3 + i * 3
    const contentId = 4 + i * 3
    const imgId = 5 + i * 3
    const w = p.widthPt.toFixed(2)
    const h = p.heightPt.toFixed(2)
    const stream = `q\n${w} 0 0 ${h} 0 0 cm\n/Im0 Do\nQ\n`

    startObj(pageId)
    pushStr(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    )
    endObj()

    startObj(contentId)
    pushStr(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`)
    endObj()

    startObj(imgId)
    pushStr(
      `<< /Type /XObject /Subtype /Image /Width ${p.widthPx} /Height ${p.heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.byteLength} >>\nstream\n`,
    )
    pushBytes(p.bytes)
    pushStr('\nendstream')
    endObj()
  })

  const totalObjs = 2 + pages.length * 3
  const xrefOffset = length
  pushStr(`xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`)
  for (let id = 1; id <= totalObjs; id++) {
    pushStr(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`)
  }
  pushStr(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`)

  return new Blob(chunks as BlobPart[], { type: 'application/pdf' })
}

export async function exportPagesAsPdf(elements: HTMLElement[], fileName: string) {
  const { toCanvas } = await import('html-to-image')
  const pdfPages: PageJpeg[] = []
  const pixelRatio = 2
  for (const el of elements) {
    // 清零外层 mx-auto / mt-6 的计算边距，避免导出画布整体右偏被裁切
    const canvas = await toCanvas(el, {
      pixelRatio,
      backgroundColor: '#ffffff',
      cacheBust: false,
      style: { margin: '0', boxShadow: 'none' },
    })
    const isLandscapeCard = elements.length > 1 || canvas.width > canvas.height * 1.15
    if (isLandscapeCard) {
      // 横版卡片按自身比例成页（A4 比例的卡片仍是标准 A4；3:2 的方案页不会被压扁）
      pdfPages.push({
        bytes: dataUrlToBytes(canvas.toDataURL('image/jpeg', 0.92)),
        widthPx: canvas.width,
        heightPx: canvas.height,
        widthPt: 841.89,
        heightPt: Math.round(841.89 * (canvas.height / Math.max(1, canvas.width)) * 100) / 100,
      })
    } else {
      const scale = canvas.height / Math.max(1, el.getBoundingClientRect().height)
      pdfPages.push(...slicePortraitCanvas(canvas, el, scale))
    }
  }
  const blob = buildPdfFromJpegs(pdfPages)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileName}.pdf`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return pdfPages.length
}
