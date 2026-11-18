import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getPayloadClient: vi.fn(),
}))

vi.mock('@/lib/app-auth', () => ({
  appAuth: { getCurrentUser: mocks.getCurrentUser },
}))
vi.mock('@/lib/payload', () => ({ getPayloadClient: mocks.getPayloadClient }))
// 注册表/插件清单只提供允许值和字段名，测试里固定最小集合，避免把内容定义拖进用例。
vi.mock('@/documents/registry', () => ({
  allStyles: () => [{ id: 'minimal' }, { id: 'modern' }],
  DOC_KIND_LIST: ['quote', 'contract'],
  DOC_KINDS: {
    quote: { layouts: [{ value: 'standard' }, { value: 'detailed' }] },
    contract: { layouts: [{ value: 'full' }] },
  },
}))
vi.mock('@/plugins', () => ({
  PLUGINS: [{ id: 'ai-copilot' }, { id: 'doc-styles' }],
}))

import { POST } from './route'

const user = { id: 'u-1', collection: 'users', status: 'active' }

function makeForm(fields: Record<string, string> = { name: '新公司名' }) {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.set(key, value)
  return form
}

function request(form: FormData) {
  return new Request('http://localhost/settings/company', { method: 'POST', body: form })
}

let update: ReturnType<typeof vi.fn>
let findByID: ReturnType<typeof vi.fn>
let mediaCreate: ReturnType<typeof vi.fn>

beforeEach(() => {
  mocks.getCurrentUser.mockReset()
  mocks.getPayloadClient.mockReset()
  update = vi.fn(async () => ({}))
  findByID = vi.fn(async () => ({
    companyProfile: {
      name: '旧公司名',
      slogan: '旧副标题',
      logo: 'logo-1',
      qrCode: null,
      printProductImages: true,
      aiChannels: [{ provider: 'openai', key: 'keep-me' }],
      disabledPlugins: ['doc-styles'],
      documentDefaults: { quote: { style: 'minimal', layout: 'standard' } },
    },
  }))
  mediaCreate = vi.fn(async () => ({ id: 'media-new' }))
  mocks.getPayloadClient.mockResolvedValue({
    findByID,
    update,
    create: mediaCreate,
  })
  mocks.getCurrentUser.mockResolvedValue(user)
})

describe('POST /settings/company', () => {
  it('未登录返回 401', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)
    const res = await POST(request(makeForm()))
    expect(res.status).toBe(401)
    await expect(res.json()).resolves.toMatchObject({ ok: false })
  })

  it('name 为空或全空格返回 400，field=name', async () => {
    for (const name of ['', '   ']) {
      const res = await POST(request(makeForm({ name })))
      expect(res.status).toBe(400)
      await expect(res.json()).resolves.toMatchObject({ ok: false, field: 'name' })
    }
    expect(update).not.toHaveBeenCalled()
  })

  it('name 超过 60 字返回 400，field=name', async () => {
    const res = await POST(request(makeForm({ name: '名'.repeat(61) })))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({
      ok: false,
      field: 'name',
      error: '内容过长（最多 60 字）',
    })
    expect(update).not.toHaveBeenCalled()
  })

  it('正常提交合并进 companyProfile，未提交的既有字段不被抹掉', async () => {
    const form = makeForm({
      name: '新公司名',
      slogan: '新副标题',
      phone: '13900000000',
      email: 'new@example.com',
      address: '新地址',
      qrCaption: '新说明',
      quoteNotes: '新备注',
      contractTerms: '新条款',
      printProductImages: 'on',
    })
    const res = await POST(request(form))
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })

    expect(update).toHaveBeenCalledTimes(1)
    const data = update.mock.calls[0]![0].data as {
      companyProfile: Record<string, unknown>
    }
    expect(data.companyProfile).toMatchObject({
      name: '新公司名',
      slogan: '新副标题',
      phone: '13900000000',
      email: 'new@example.com',
      address: '新地址',
      qrCaption: '新说明',
      quoteNotes: '新备注',
      contractTerms: '新条款',
      printProductImages: true,
      logo: 'logo-1',
      qrCode: null,
      // 表单没带 plugins-present，插件开关保持原样
      disabledPlugins: ['doc-styles'],
    })
    // 表单没带文档模板字段，既有模板设置保持原样
    expect(data.companyProfile.aiChannels).toEqual([{ provider: 'openai', key: 'keep-me' }])
    expect(data.companyProfile.documentDefaults).toEqual({
      quote: { style: 'minimal', layout: 'standard' },
    })
  })

  it('表单没有 plugins-present 时不改写 disabledPlugins', async () => {
    await POST(request(makeForm({ name: '新公司名', 'plugin-ai-copilot': 'on' })))
    const data = update.mock.calls[0]![0].data as { companyProfile: Record<string, unknown> }
    expect(data.companyProfile.disabledPlugins).toEqual(['doc-styles'])
  })

  it('带 plugins-present 时按勾选结果重算 disabledPlugins', async () => {
    await POST(
      request(
        makeForm({
          name: '新公司名',
          'plugins-present': '1',
          'plugin-doc-styles': 'on',
          // ai-copilot 没勾选 → 关闭
        }),
      ),
    )
    const data = update.mock.calls[0]![0].data as { companyProfile: Record<string, unknown> }
    expect(data.companyProfile.disabledPlugins).toEqual(['ai-copilot'])
  })

  it('文档模板字段只接受已登记的风格和版式', async () => {
    await POST(
      request(
        makeForm({
          name: '新公司名',
          'doc-quote-style': 'modern',
          'doc-quote-layout': 'detailed',
          'doc-contract-style': 'not-registered',
          'doc-contract-layout': 'full',
        }),
      ),
    )
    const data = update.mock.calls[0]![0].data as { companyProfile: Record<string, unknown> }
    expect(data.companyProfile.documentDefaults).toEqual({
      quote: { style: 'modern', layout: 'detailed' },
      contract: { layout: 'full' },
    })
  })

  it('非法图片类型返回 400，field=logo', async () => {
    const form = makeForm({ name: '新公司名' })
    form.set('logo', new File(['hello'], 'a.txt', { type: 'text/plain' }))
    const res = await POST(request(form))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ ok: false, field: 'logo' })
    expect(update).not.toHaveBeenCalled()
  })

  it('图片超过 3MB 返回 400，field=qrCode', async () => {
    const form = makeForm({ name: '新公司名' })
    const big = new File([new Uint8Array(3 * 1024 * 1024 + 1)], 'qr.png', { type: 'image/png' })
    form.set('qrCode', big)
    const res = await POST(request(form))
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toMatchObject({ ok: false, field: 'qrCode' })
    expect(update).not.toHaveBeenCalled()
  })

  it('上传合法图片时创建 media 并写入关系 id', async () => {
    const form = makeForm({ name: '新公司名' })
    form.set('logo', new File([new Uint8Array(16)], 'logo.png', { type: 'image/png' }))
    const res = await POST(request(form))
    expect(res.status).toBe(200)
    expect(mediaCreate).toHaveBeenCalledTimes(1)
    const data = update.mock.calls[0]![0].data as { companyProfile: Record<string, unknown> }
    expect(data.companyProfile.logo).toBe('media-new')
  })

  it('logoRemove=1 时清空已有 logo', async () => {
    const form = makeForm({ name: '新公司名' })
    form.set('logoRemove', '1')
    const res = await POST(request(form))
    expect(res.status).toBe(200)
    const data = update.mock.calls[0]![0].data as { companyProfile: Record<string, unknown> }
    expect(data.companyProfile.logo).toBeNull()
  })
})
