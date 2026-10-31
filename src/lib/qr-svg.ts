/**
 * 零依赖标准 QR Code（ISO/IEC 18004 Version 3-L，29×29 矩阵，最大支持 53 字节 UTF-8 文本）SVG 生成器。
 * 用于电脑登录页展示「小程序扫码登录」二维码（支持微信扫一扫及小程序 wx.scanCode 识别）。
 */

const SIZE = 29 // Version 3: 17 + 4 * 3 = 29
const DATA_CODEWORDS = 55
const EC_CODEWORDS = 15

const GF_EXP = new Uint8Array(512)
const GF_LOG = new Uint8Array(256)
;(() => {
  let x = 1
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x
    GF_LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255]
})()

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return GF_EXP[GF_LOG[a] + GF_LOG[b]]
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1])
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1)
    const factor = GF_EXP[i]
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j]
      next[j + 1] ^= gfMul(poly[j], factor)
    }
    poly = next
  }
  return poly
}

function rsEncode(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLen)
  const rem = new Uint8Array(ecLen)
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0]
    rem.copyWithin(0, 1)
    rem[ecLen - 1] = 0
    for (let j = 0; j < ecLen; j++) {
      rem[j] ^= gfMul(gen[j + 1], factor)
    }
  }
  return rem
}

function encodeCodewords(text: string): Uint8Array {
  const bytes = new TextEncoder().encode(text.slice(0, 53))
  const bits: number[] = []
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1)
  }
  pushBits(0b0100, 4) // Byte mode
  pushBits(bytes.length, 8)
  for (const b of bytes) pushBits(b, 8)
  const maxBits = DATA_CODEWORDS * 8
  pushBits(0, Math.min(4, maxBits - bits.length))
  while (bits.length % 8 !== 0) bits.push(0)

  const data = new Uint8Array(DATA_CODEWORDS)
  for (let i = 0; i < bits.length / 8; i++) {
    let byte = 0
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i * 8 + b]
    data[i] = byte
  }
  let padIdx = Math.floor(bits.length / 8)
  let toggle = true
  while (padIdx < DATA_CODEWORDS) {
    data[padIdx++] = toggle ? 0xec : 0x11
    toggle = !toggle
  }
  const ec = rsEncode(data, EC_CODEWORDS)
  const out = new Uint8Array(DATA_CODEWORDS + EC_CODEWORDS)
  out.set(data, 0)
  out.set(ec, DATA_CODEWORDS)
  return out
}

export function renderQrSvgDataUrl(text: string): string {
  const grid = Array.from({ length: SIZE }, () => new Uint8Array(SIZE))
  const reserved = Array.from({ length: SIZE }, () => new Uint8Array(SIZE))

  const setModule = (r: number, c: number, dark: boolean) => {
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return
    grid[r][c] = dark ? 1 : 0
    reserved[r][c] = 1
  }

  const placeFinder = (row: number, col: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6
        const inBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6
        const inCenter = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4
        setModule(row + dr, col + dc, inOuter && (inBorder || inCenter))
      }
    }
  }
  placeFinder(0, 0)
  placeFinder(0, SIZE - 7)
  placeFinder(SIZE - 7, 0)

  // Alignment pattern for Version 3 at (22, 22)
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      setModule(22 + dr, 22 + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1)
    }
  }

  // Timing patterns
  for (let i = 8; i < SIZE - 8; i++) {
    setModule(6, i, i % 2 === 0)
    setModule(i, 6, i % 2 === 0)
  }

  // Dark module & reserve format areas
  setModule(SIZE - 8, 8, true)
  for (let i = 0; i < 9; i++) {
    if (!reserved[8][i]) reserved[8][i] = 1
    if (!reserved[i][8]) reserved[i][8] = 1
  }
  for (let i = SIZE - 8; i < SIZE; i++) {
    reserved[8][i] = 1
    reserved[i][8] = 1
  }

  // Place data bits with mask 0 ((r + c) % 2 === 0)
  const codewords = encodeCodewords(text)
  let bitIdx = 0
  const totalBits = codewords.length * 8
  let upward = true
  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < SIZE; vert++) {
      const r = upward ? SIZE - 1 - vert : vert
      for (let j = 0; j < 2; j++) {
        const c = right - j
        if (reserved[r][c]) continue
        let dark = false
        if (bitIdx < totalBits) {
          dark = ((codewords[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1) === 1
          bitIdx++
        }
        if ((r + c) % 2 === 0) dark = !dark
        grid[r][c] = dark ? 1 : 0
      }
    }
    upward = !upward
  }

  // Format bits for ECC Level L (01) + Mask 0 (000) -> 0x77c4
  const formatBits = 0x77c4
  for (let i = 0; i <= 5; i++) grid[8][i] = (formatBits >> (14 - i)) & 1
  grid[8][7] = (formatBits >> 8) & 1
  grid[8][8] = (formatBits >> 7) & 1
  grid[7][8] = (formatBits >> 6) & 1
  for (let i = 9; i < 15; i++) grid[14 - i][8] = (formatBits >> (14 - i)) & 1
  for (let i = 0; i < 8; i++) grid[8][SIZE - 1 - i] = (formatBits >> i) & 1
  for (let i = 8; i < 15; i++) grid[SIZE - 15 + i][8] = (formatBits >> i) & 1

  const margin = 3
  const dim = SIZE + margin * 2
  let path = ''
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c]) path += `M${c + margin},${r + margin}h1v1h-1z`
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges"><rect width="${dim}" height="${dim}" fill="#ffffff"/><path d="${path}" fill="#111827"/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
