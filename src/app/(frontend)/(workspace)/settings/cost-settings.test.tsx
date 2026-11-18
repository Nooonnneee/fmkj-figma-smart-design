// @vitest-environment happy-dom
import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  saveCostSettings: vi.fn(),
  refresh: vi.fn(),
  showToast: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh, replace: vi.fn() }),
}))
vi.mock('@astryxdesign/core/Toast', () => ({ useToast: () => mocks.showToast }))
vi.mock('./actions', () => ({ saveCostSettings: mocks.saveCostSettings }))

import { CostSettingsCard, type CostBrandOption } from './cost-settings'

const brands: CostBrandOption[] = [
  { slug: 'aqara', name: 'Aqara', logo: null, products: 3 },
  { slug: 'yeelight', name: 'Yeelight', logo: null, products: 2 },
]

const initial = {
  brandRates: [{ brand: 'aqara', rate: 0.65 }], // 6.5 折
  defaultRate: null,
  feeCostPercent: 12,
  minMarginPercent: 25,
}

let container: HTMLDivElement
let root: Root

async function mount() {
  await act(async () => {
    root.render(<CostSettingsCard initial={initial} brands={brands} />)
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  mocks.saveCostSettings.mockReset()
  mocks.refresh.mockReset()
  mocks.showToast.mockReset()
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function clickSave() {
  const btn = Array.from(container.querySelectorAll('button')).find((b) =>
    b.textContent?.includes('保存成本设置'),
  ) as HTMLButtonElement
  await act(async () => btn.click())
  await Promise.resolve()
  await Promise.resolve()
}

describe('报价成本与毛利设置卡', () => {
  it('点保存把界面上的值交给 saveCostSettings，成功提示并刷新', async () => {
    mocks.saveCostSettings.mockResolvedValue({
      ok: true,
      settings: initial,
    })
    await mount()
    await clickSave()

    expect(mocks.saveCostSettings).toHaveBeenCalledTimes(1)
    expect(mocks.saveCostSettings.mock.calls[0]![0]).toMatchObject({
      minMarginPercent: 25,
      feeCostPercent: 12,
      defaultDiscount: null,
      brandRates: [{ brand: 'aqara', discount: 6.5 }],
    })
    expect(mocks.showToast).toHaveBeenCalled()
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
  })

  it('数值箭头步进后带上新值', async () => {
    mocks.saveCostSettings.mockResolvedValue({ ok: true, settings: initial })
    await mount()
    const spin = container.querySelector('input[role="spinbutton"]') as HTMLInputElement
    await act(async () => spin.focus())
    await act(async () =>
      spin.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })),
    )
    await clickSave()

    const input = mocks.saveCostSettings.mock.calls[0]![0] as {
      minMarginPercent: number
    }
    expect(input.minMarginPercent).toBe(26)
  })

  it('失败时显示错误提示，不刷新', async () => {
    mocks.saveCostSettings.mockResolvedValue({
      ok: false,
      error: '服务端保存失败',
      fieldErrors: { minMarginPercent: '毛利率需在 0–99 之间' },
    })
    await mount()
    await clickSave()

    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ body: '服务端保存失败', type: 'error' }),
    )
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})
