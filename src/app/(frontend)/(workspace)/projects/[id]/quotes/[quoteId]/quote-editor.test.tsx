// @vitest-environment happy-dom
import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// 报价台是客户端组件，但会 import Server Actions；测试只验证列表渲染，换成空桩。
vi.mock('../actions', () => ({
  saveQuote: vi.fn(async () => ({ ok: true, total: 0 })),
  syncQuoteFromPointMap: vi.fn(async () => ({ ok: true })),
  setQuoteProjectDefault: vi.fn(async () => ({ ok: true })),
}))
vi.mock('../../contract/actions', () => ({ createContract: vi.fn(async () => ({ ok: true })) }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}))
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src?: string; alt?: string }) => (
    <span data-image-src={src} aria-label={alt || undefined} />
  ),
}))
vi.mock('@astryxdesign/core/Toast', () => ({ useToast: () => vi.fn() }))

import {
  QuoteEditor,
  QuoteItemName,
  newQuoteLine,
  swapQuoteLine,
  type ProductOption,
} from './quote-editor'

const LONG_NAME = '易来智能LED嵌入式防眩筒灯射灯窄边框过道灯深杯无主灯 T3智能筒灯2.0'
const SHORT_NAME = '易来 T3 筒灯'

const product = (over: Partial<ProductOption> = {}): ProductOption => ({
  id: 'prod-1',
  name: LONG_NAME,
  shortName: SHORT_NAME,
  sku: 'YL-T3',
  unit: '个',
  price: 129,
  status: 'active',
  deviceType: 'downlight',
  brand: null,
  platforms: [],
  image: null,
  ...over,
})

let container: HTMLDivElement
let root: Root

async function mount(ui: React.ReactElement) {
  await act(async () => {
    root.render(ui)
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  window.localStorage.clear()
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  window.localStorage.clear()
})

describe('报价明细行的名称显示', () => {
  it('有短名时视觉显示短名，读屏器拿到完整名称', async () => {
    await mount(<QuoteItemName item={{ name: LONG_NAME, shortName: SHORT_NAME }} />)

    const el = container.querySelector(`[title="${LONG_NAME}"]`) as HTMLElement
    expect(el).not.toBeNull()
    // 可见文字是短名，且对读屏器隐藏（不能把简称当成正式名称）
    const visible = el.querySelector('[aria-hidden="true"]') as HTMLElement
    expect(visible.textContent).toBe(SHORT_NAME)
    // sr-only 完整名称供读屏器读取；不占用视觉排版
    expect(el.querySelector('.sr-only')?.textContent).toBe(LONG_NAME)
    expect(el.getAttribute('aria-label')).toBeNull()
    // 单行渲染：不允许换行撑高行高
    expect(el.className).toContain('truncate')
  })

  it('没有短名时回退显示完整名称，且不做多余的隐藏', async () => {
    await mount(<QuoteItemName item={{ name: LONG_NAME, shortName: null }} />)

    const el = container.querySelector(`[title="${LONG_NAME}"]`) as HTMLElement
    expect(el).not.toBeNull()
    expect(el.textContent).toBe(LONG_NAME)
    expect(el.querySelector('[aria-hidden]')).toBeNull()
    expect(el.querySelector('.sr-only')).toBeNull()
  })

  it('挂载报价台明细列表时，两种行混排都按同一规则显示', async () => {
    await mount(
      <QuoteEditor
        quote={{
          id: 'q-1',
          title: '客厅报价',
          status: 'draft',
          discount: 0,
          notes: '',
          items: [
            {
              key: 'line-with-short',
              id: 'row-1',
              product: 'prod-1',
              deviceType: 'downlight',
              image: null,
              name: LONG_NAME,
              shortName: SHORT_NAME,
              sku: 'YL-T3',
              unit: '个',
              price: 129,
              quantity: 2,
            },
            {
              key: 'line-without-short',
              id: 'row-2',
              product: null,
              deviceType: null,
              image: null,
              name: '旧型号开关（无短名）',
              shortName: '',
              sku: 'OLD-1',
              unit: '个',
              price: 59,
              quantity: 1,
            },
          ],
          fees: [],
        }}
        project={{ id: 'p-1', name: '示例项目', customerName: '林先生' }}
        products={[product()]}
        costs={null}
        readOnly={false}
      />,
    )

    const shortRow = container.querySelector(`[title="${LONG_NAME}"]`) as HTMLElement
    const fullRow = container.querySelector('[title="旧型号开关（无短名）"]') as HTMLElement
    expect(shortRow.querySelector('[aria-hidden="true"]')?.textContent).toBe(SHORT_NAME)
    expect(shortRow.querySelector('.sr-only')?.textContent).toBe(LONG_NAME)
    expect(fullRow.textContent).toBe('旧型号开关（无短名）')
    // 两行都只有一行标题文本；行高由同一套 truncate 样式控制
    expect(shortRow.className).toContain('truncate')
    expect(fullRow.className).toContain('truncate')
    // 短名只影响名称列；单价 / 数量控件仍然可被读屏器访问
    const price = container.querySelector(
      `input[aria-label="${LONG_NAME} 单价"]`,
    ) as HTMLElement | null
    const quantity = container.querySelector(
      `input[aria-label="${LONG_NAME} 数量"]`,
    ) as HTMLElement | null
    expect(price).not.toBeNull()
    expect(quantity).not.toBeNull()
    expect(price?.closest('[aria-hidden="true"]')).toBeNull()
    expect(quantity?.closest('[aria-hidden="true"]')).toBeNull()
  })
})

describe('添加 / 更换产品时复制短名', () => {
  it('新增行快照带上产品短名', () => {
    const line = newQuoteLine(product())
    expect(line).toMatchObject({
      product: 'prod-1',
      name: LONG_NAME,
      shortName: SHORT_NAME,
      sku: 'YL-T3',
      quantity: 1,
    })
  })

  it('换型号时短名、名称、型号和单价一起换成新产品，数量不变', () => {
    const before = newQuoteLine(product({ id: 'prod-old', shortName: '旧短名' }))
    before.quantity = 3
    const next = swapQuoteLine(
      before,
      product({ id: 'prod-new', name: '新品全名', shortName: '新品短名', sku: 'NEW-1', price: 88 }),
    )

    expect(next).toMatchObject({
      key: before.key,
      product: 'prod-new',
      name: '新品全名',
      shortName: '新品短名',
      sku: 'NEW-1',
      price: 88,
      quantity: 3,
    })
  })
})
