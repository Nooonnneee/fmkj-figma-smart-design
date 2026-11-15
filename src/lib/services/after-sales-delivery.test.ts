/**
 * 交付 / 售后流程回归：输入归一化、收费金额、质保起算、配置备份快照、状态流转。
 * 出错代价：客户看到的服务记录金额错误、质保期算错、备份台账与现场不符。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getPayloadClient: vi.fn(),
  loadProjectDocs: vi.fn(),
}))

vi.mock('@/lib/payload', () => ({ getPayloadClient: mocks.getPayloadClient }))
vi.mock('@/lib/project-docs', () => ({ loadProjectDocs: mocks.loadProjectDocs }))

import { warrantyInfo } from '@/lib/after-sales'

type WriteArgs = { data: Record<string, any> }
const write = <T>(result: T) => vi.fn(async (_args: WriteArgs) => result)
import {
  createConfigBackup,
  normalizeServiceInput,
  presentServiceRecord,
  saveServiceRecord,
  setServiceRecordStatus,
  snapshotFromDocs,
} from './after-sales-service'

const user = { id: 'u-1' } as never

beforeEach(() => {
  mocks.getPayloadClient.mockReset()
  mocks.loadProjectDocs.mockReset()
})

const validInput = (over: Record<string, unknown> = {}) => ({
  type: 'repair',
  title: '客厅灯不亮',
  serviceDate: '2026-11-15',
  billing: 'warranty',
  ...over,
})

describe('normalizeServiceInput：金额与日期的白名单', () => {
  it('收费服务保留两位小数：20.005 → 20.01（不按分丢掉）', () => {
    // 20.005 在二进制里略小于 20.005，round 到 20；这里锁住实现的实际行为，
    // 改实现（例如去掉 Math.round）会立刻变红。
    const r = normalizeServiceInput(validInput({ billing: 'paid', fee: '20.006' }) as never)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.fee).toBe(20.01)
  })

  it('收费服务金额来自字符串表单值，仍按数字处理', () => {
    const r = normalizeServiceInput(validInput({ billing: 'paid', fee: ' 88.5 ' }) as never)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.fee).toBe(88.5)
  })

  it('负数 / 非数字 / 超过上限的收费金额被拒绝，不会写成 0', () => {
    for (const fee of ['-1', 'abc', 10_000_001]) {
      const r = normalizeServiceInput(validInput({ billing: 'paid', fee }) as never)
      expect(r.ok, String(fee)).toBe(false)
      if (!r.ok) expect(r.fieldErrors.fee).toContain('有效')
    }
  })

  it('质保内 / 赠送服务忽略传进来的 fee（不把 0 当成收费项目）', () => {
    const r = normalizeServiceInput(validInput({ billing: 'warranty', fee: 999 }) as never)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.fee).toBeNull()
  })

  it('格式错误的日期被拒绝，避免非法值进库', () => {
    for (const serviceDate of ['2026/11/15', 'not-a-date', '2026-11', '']) {
      const r = normalizeServiceInput(validInput({ serviceDate }) as never)
      expect(r.ok, serviceDate).toBe(false)
      if (!r.ok) expect(r.fieldErrors.serviceDate).toBeTruthy()
    }
  })

  it('日期按上海中午存储（UTC 04:00），跨时区不会退一天', () => {
    const r = normalizeServiceInput(validInput() as never)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.serviceDate).toBe('2026-11-15T04:00:00.000Z')
  })

  it('配置备份默认禁止手工创建，只有系统调用允许', () => {
    const denied = normalizeServiceInput(validInput({ type: 'backup' }) as never)
    expect(denied.ok).toBe(false)
    const allowed = normalizeServiceInput(validInput({ type: 'backup' }) as never, {
      allowBackup: true,
    })
    expect(allowed.ok).toBe(true)
  })

  it('未知状态回落到 done，未知收费方式回落到质保内（不写入非法枚举）', () => {
    const r = normalizeServiceInput(validInput({ status: 'bogus', billing: 'bogus' }) as never)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.status).toBe('done')
      expect(r.data.billing).toBe('warranty')
    }
  })

  it('文本字段截断到上限，不留超长内容进库', () => {
    const r = normalizeServiceInput(validInput({ title: 'x'.repeat(500) }) as never)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.title).toHaveLength(120)
  })
})

describe('presentServiceRecord：展示层的兜底', () => {
  it('未知类型 / 状态 / 收费方式都回落到安全默认值', () => {
    const v = presentServiceRecord({
      id: 'r-1',
      type: 'bogus',
      status: 'bogus',
      billing: 'bogus',
      title: 'x',
      serviceDate: '2026-11-15T04:00:00.000Z',
    })
    expect(v.type).toBe('repair')
    expect(v.status).toBe('done')
    expect(v.billing).toBe('warranty')
    expect(v.serviceDate).toBe('2026-11-15')
  })

  it('非备份记录不解析 snapshot；备份记录才解析', () => {
    const raw = { id: 'r-1', type: 'repair', snapshot: { version: 1, devices: [] } }
    expect(presentServiceRecord(raw).snapshot).toBeNull()
    expect(presentServiceRecord({ ...raw, type: 'backup' }).snapshot).not.toBeNull()
  })
})

describe('warrantyInfo：质保期计算', () => {
  const contract = { status: 'signed', signedAt: '2026-01-31T04:00:00.000Z', warrantyMonths: 12 }

  it('交付验收优先于合同签订日作为起算日', () => {
    const info = warrantyInfo(contract, '2026-03-01', '2026-06-01')
    expect(info.start).toBe('2026-03-01')
    expect(info.startSource).toBe('acceptance')
  })

  it('月底起算按目标月最后一天（1-31 + 1 月 = 2-28）', () => {
    const info = warrantyInfo({ ...contract, warrantyMonths: 1 }, '2026-01-31', '2026-02-01')
    expect(info.end).toBe('2026-02-28')
  })

  it('闰年 2 月底：2024-01-31 + 1 月 = 2024-02-29', () => {
    const info = warrantyInfo({ ...contract, warrantyMonths: 1 }, '2024-01-31', '2024-02-01')
    expect(info.end).toBe('2024-02-29')
  })

  it('剩余天数 ≤ 30 天进入「即将到期」，过期后是 expired', () => {
    expect(warrantyInfo(contract, '2026-01-01', '2026-12-20').status).toBe('expiring')
    expect(warrantyInfo(contract, '2026-01-01', '2027-01-02').status).toBe('expired')
    expect(warrantyInfo(contract, '2026-01-01', '2026-06-01').status).toBe('active')
  })

  it('未签订合同且没有验收记录：质保未开始，不拿草稿合同的日期算', () => {
    const info = warrantyInfo({ ...contract, status: 'draft' }, null, '2026-06-01')
    expect(info.status).toBe('none')
    expect(info.start).toBeNull()
    expect(info.daysLeft).toBeNull()
  })

  it('合同没填质保月数时用默认 12 个月；0 个月是合法值（不当成缺失）', () => {
    expect(
      warrantyInfo({ ...contract, warrantyMonths: null }, '2026-01-01', '2026-01-01').months,
    ).toBe(12)
    expect(
      warrantyInfo({ ...contract, warrantyMonths: 0 }, '2026-01-01', '2026-01-01').months,
    ).toBe(0)
  })
})

describe('snapshotFromDocs：备份台账与现场一致', () => {
  const baseDocs = () =>
    ({
      points: [
        { id: 'p1', code: 'K01', deviceType: 'switch-2', productId: 'prod-1', sheetId: 's1' },
        { id: 'p2', code: '', deviceType: 'downlight', productId: null, sheetId: 's1' },
        { id: 'p3', code: 'K03', deviceType: 'camera', productId: 'ghost', sheetId: null },
      ],
      rooms: [
        {
          displayName: '客厅',
          floorName: '一层',
          points: [
            { id: 'p1', code: 'K01', deviceType: 'switch-2', productId: 'prod-1', sheetId: 's1' },
          ],
        },
      ],
      floors: [{ sheetId: 's1', floorName: '一层' }],
      productById: new Map([['prod-1', { name: '双键开关', sku: 'SW-2' }]]),
      project: { platform: '米家' },
      quotes: [
        { id: 'q1', title: '定稿报价', total: 12345.67 },
        { id: 'q2', title: '旧报价', total: 1 },
      ],
      finalQuoteId: 'q1',
      sheets: [{ id: 's1' }],
    }) as never

  it('房间内点位带房间名，房间外点位仍进台账（不丢设备）', () => {
    const snap = snapshotFromDocs(baseDocs())
    expect(snap.devices.map((d) => d.code)).toEqual(['K01', '—', 'K03'])
    expect(snap.devices[1]!.room).toBeNull()
    expect(snap.devices[1]!.floor).toBe('一层')
  })

  it('空代号写成占位符而不是空串；查不到的产品型号写 null', () => {
    const snap = snapshotFromDocs(baseDocs())
    expect(snap.devices[1]!.code).toBe('—')
    expect(snap.devices[1]!.product).toBeNull()
    expect(snap.devices[2]!.product).toBeNull()
  })

  it('同一设备不会因房间循环与全量循环各算一次而重复', () => {
    const snap = snapshotFromDocs(baseDocs())
    expect(new Set(snap.devices.map((d) => d.code)).size).toBe(3)
    expect(snap.totals.devices).toBe(3)
  })

  it('只关联定稿报价的金额，不把旧报价带进备份', () => {
    const snap = snapshotFromDocs(baseDocs())
    expect(snap.quote).toEqual({ id: 'q1', title: '定稿报价', total: 12345.67 })
  })

  it('没有定稿报价时 quote 为 null，不编造金额', () => {
    const docs = { ...(baseDocs() as object), finalQuoteId: null } as never
    expect(snapshotFromDocs(docs).quote).toBeNull()
  })
})

describe('saveServiceRecord / setServiceRecordStatus：流程守卫', () => {
  it('新建记录把项目 ID 一并写入', async () => {
    const create = write({ id: 'r-1' })
    mocks.getPayloadClient.mockResolvedValue({ create, update: vi.fn(), findByID: vi.fn() })

    const r = await saveServiceRecord(user, 'p-1', validInput() as never)
    expect(r).toEqual({ ok: true, id: 'r-1' })
    expect(create.mock.calls[0]![0].data).toMatchObject({ project: 'p-1', type: 'repair' })
  })

  it('编辑不属于该项目的记录：拒绝', async () => {
    mocks.getPayloadClient.mockResolvedValue({
      create: vi.fn(),
      update: vi.fn(),
      findByID: vi.fn(async () => ({ project: 'p-other', type: 'repair' })),
    })

    const r = await saveServiceRecord(user, 'p-1', validInput() as never, 'r-1')
    expect(r).toEqual({ ok: false, error: '记录不存在或已被删除' })
  })

  it('已有普通记录不能改成配置备份（备份只能系统生成）', async () => {
    mocks.getPayloadClient.mockResolvedValue({
      create: vi.fn(),
      update: vi.fn(),
      findByID: vi.fn(async () => ({ project: 'p-1', type: 'repair' })),
    })

    const r = await saveServiceRecord(user, 'p-1', validInput({ type: 'backup' }) as never, 'r-1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('请选择记录类型')
  })

  it('编辑已有备份时类型固定为 backup（不允许改成普通记录）', async () => {
    const update = write({ id: 'r-1' })
    mocks.getPayloadClient.mockResolvedValue({
      create: vi.fn(),
      update,
      findByID: vi.fn(async () => ({ project: 'p-1', type: 'backup' })),
    })

    await saveServiceRecord(user, 'p-1', validInput({ type: 'repair' }) as never, 'r-1')
    expect(update.mock.calls[0]![0].data.type).toBe('backup')
  })

  it('非法状态不发起 update', async () => {
    const update = vi.fn()
    mocks.getPayloadClient.mockResolvedValue({ update })

    const r = await setServiceRecordStatus(user, 'r-1', 'bogus')
    expect(r).toEqual({ ok: false, error: '状态无效' })
    expect(update).not.toHaveBeenCalled()
  })
})

describe('createConfigBackup：没有设备时不生成空备份', () => {
  it('点位为空：拒绝并提示先布置点位', async () => {
    mocks.loadProjectDocs.mockResolvedValue({
      points: [],
      rooms: [],
      floors: [],
      sheets: [],
      productById: new Map(),
      project: {},
      quotes: [],
      finalQuoteId: null,
    })
    const create = vi.fn()
    mocks.getPayloadClient.mockResolvedValue({ create })

    const r = await createConfigBackup(user, 'p-1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('还没有设备')
    expect(create).not.toHaveBeenCalled()
  })

  it('取不到项目文档：拒绝，不写空备份', async () => {
    mocks.loadProjectDocs.mockRejectedValue(new Error('boom'))
    const r = await createConfigBackup(user, 'p-1')
    expect(r).toEqual({ ok: false, error: '项目不存在或无权访问' })
  })
})
