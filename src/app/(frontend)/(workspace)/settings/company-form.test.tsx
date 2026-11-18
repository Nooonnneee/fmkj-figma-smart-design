// @vitest-environment happy-dom
import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  showToast: vi.fn(),
  registerLeaveGuard: vi.fn(() => vi.fn()),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh, replace: vi.fn() }),
}))
vi.mock('@astryxdesign/core/Toast', () => ({ useToast: () => mocks.showToast }))
vi.mock('@/lib/leave-guard', () => ({ registerLeaveGuard: mocks.registerLeaveGuard }))

import { CompanyForm, type PluginOption } from './company-form'

const initial = {
  name: '旧公司名',
  slogan: '旧副标题',
  phone: '13800000000',
  email: 'old@example.com',
  address: '旧地址',
  qrCaption: '扫码加微信',
  quoteNotes: '旧报价备注',
  contractTerms: '旧合同条款',
  printProductImages: true,
  logoUrl: '/old-logo.png',
  qrCodeUrl: '/old-qr.png',
}

const plugins: PluginOption[] = [
  {
    id: 'ai-copilot',
    name: 'AI 对话侧栏',
    description: 'AI 助手',
    categoryLabel: 'AI',
    status: 'ready',
    enabled: true,
  },
  {
    id: 'doc-styles',
    name: '文档风格包',
    description: '更多风格',
    categoryLabel: '模板',
    status: 'ready',
    enabled: true,
  },
]

const documents = {
  kinds: [
    {
      kind: 'quote',
      label: '报价单',
      layouts: [
        { value: 'standard', label: '标准版' },
        { value: 'detailed', label: '图文版' },
      ],
    },
  ],
  styles: [
    {
      id: 'minimal',
      name: '简约',
      description: '',
      swatch: ['#fff', '#111', '#eee'],
      enabled: true,
    },
    {
      id: 'modern',
      name: '现代',
      description: '',
      swatch: ['#fff', '#06f', '#eee'],
      enabled: true,
    },
  ],
  defaults: { quote: { style: 'minimal', layout: 'standard' } },
}

let container: HTMLDivElement
let root: Root

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function mount() {
  await act(async () => {
    root.render(<CompanyForm initial={initial} plugins={plugins} documents={documents} />)
    await Promise.resolve()
    await Promise.resolve()
  })
}

function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

const nameInput = () => container.querySelector('#name') as HTMLInputElement
const bar = () => container.querySelector('[data-testid="settings-save-bar"]') as HTMLElement | null
const barButton = (label: string) =>
  Array.from(bar()?.querySelectorAll('button') ?? []).find((b) =>
    b.textContent?.includes(label),
  ) as HTMLButtonElement | undefined

async function submitForm() {
  const form = container.querySelector('form') as HTMLFormElement
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

const okFetch = () =>
  vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }) as unknown as Response)

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  mocks.refresh.mockReset()
  mocks.showToast.mockReset()
  mocks.registerLeaveGuard.mockClear()
  mocks.registerLeaveGuard.mockImplementation(() => vi.fn())
  vi.stubGlobal('fetch', okFetch())
  // happy-dom 没有实现 object URL；ImageField 预览会用到
  if (!URL.createObjectURL) URL.createObjectURL = vi.fn(() => 'blob:preview')
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('设置页品牌表单的保存条', () => {
  it('初始渲染显示服务端值，且没有保存条', async () => {
    await mount()
    expect(nameInput().value).toBe(initial.name)
    expect(bar()).toBeNull()
  })

  it('改名称后出现保存条；点保存提交新名称、提示成功并刷新', async () => {
    await mount()
    await act(async () => setValue(nameInput(), '新公司名'))
    expect(bar()).not.toBeNull()
    expect(bar()!.textContent).toContain('有未保存的修改')

    await submitForm()

    const fetchMock = vi.mocked(fetch)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/settings/company')
    const body = init.body as FormData
    expect(body.get('name')).toBe('新公司名')
    expect(mocks.showToast).toHaveBeenCalledWith({ body: '设置已保存' })
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
    expect(bar()).toBeNull()
  })

  it('点撤销恢复初始值并消失保存条', async () => {
    await mount()
    await act(async () => setValue(nameInput(), '改了一半'))
    expect(bar()).not.toBeNull()

    await act(async () => barButton('撤销')!.click())
    expect(nameInput().value).toBe(initial.name)
    expect(bar()).toBeNull()
  })

  it('服务端字段错误用 role=alert 显示，保存条仍在', async () => {
    await mount()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ ok: false, error: '内容过长（最多 60 字）', field: 'name' }),
      })) as unknown as typeof fetch,
    )
    await act(async () => setValue(nameInput(), '新公司名'))
    await submitForm()

    const alert = container.querySelector('[role="alert"]')
    expect(alert?.textContent).toContain('内容过长（最多 60 字）')
    expect(bar()).not.toBeNull()
  })

  it('网络异常显示「网络错误，请稍后重试」，保存条仍在', async () => {
    await mount()
    await act(async () => setValue(nameInput(), '新公司名'))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }) as unknown as typeof fetch,
    )
    await submitForm()

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('网络错误，请稍后重试')
    expect(bar()).not.toBeNull()
  })

  it('切换插件开关也会让保存条出现', async () => {
    await mount()
    const pluginSwitch = container.querySelector(
      'input[name="plugin-ai-copilot"]',
    ) as HTMLInputElement
    expect(pluginSwitch).not.toBeNull()

    await act(async () => pluginSwitch.click())
    expect(bar()).not.toBeNull()
  })

  it('改文档模板选择器也会让保存条出现', async () => {
    await mount()
    const trigger = container.querySelector('[role="combobox"]') as HTMLElement
    expect(trigger).not.toBeNull()

    await act(async () => trigger.click())
    await flush()
    const options = Array.from(document.body.querySelectorAll('[role="option"]'))
    expect(options.length).toBeGreaterThan(1)
    await act(async () => (options[1] as HTMLElement).click())
    await flush()

    expect(bar()).not.toBeNull()
  })

  it('选择 logo 文件后保存条出现', async () => {
    await mount()
    const input = container.querySelector('#logo') as HTMLInputElement
    const file = new File(['x'], 'logo.png', { type: 'image/png' })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })

    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
    expect(bar()).not.toBeNull()
  })

  it('点移除已有 logo 后保存条出现', async () => {
    await mount()
    const remove = container.querySelector('[aria-label="移除Logo"]') as HTMLButtonElement
    expect(remove).not.toBeNull()

    await act(async () => remove.click())
    expect(bar()).not.toBeNull()
  })

  it('dirty 时注册 beforeunload 与站内守卫，撤销后两者都释放', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    await mount()

    const unloadCalls = () => addSpy.mock.calls.filter(([type]) => type === 'beforeunload')
    const unloadRemovals = () => removeSpy.mock.calls.filter(([type]) => type === 'beforeunload')
    expect(unloadCalls()).toHaveLength(0)
    expect(mocks.registerLeaveGuard).not.toHaveBeenCalled()

    await act(async () => setValue(nameInput(), '新公司名'))
    expect(unloadCalls()).toHaveLength(1)
    expect(mocks.registerLeaveGuard).toHaveBeenCalledTimes(1)
    const release = mocks.registerLeaveGuard.mock.results[0]!.value as ReturnType<typeof vi.fn>

    await act(async () => barButton('撤销')!.click())
    expect(unloadRemovals()).toHaveLength(1)
    expect(release).toHaveBeenCalledTimes(1)
  })
})
