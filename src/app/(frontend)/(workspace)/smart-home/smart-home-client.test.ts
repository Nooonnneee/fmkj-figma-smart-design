// @vitest-environment happy-dom

/**
 * HC-3 / HC-4 行为测试：真挂载 `SmartHomeClient`，注入 mock 的
 * `window.fanmengDesktop`，喂输入后断言真实 DOM 与调用参数。
 *
 * 不用源码字符串断言 —— 这里检查的是「用户能看到什么、点了按钮发生什么」。
 */

import * as React from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getDesktopHa,
  type HaCallServiceInput,
  type HaEntityState,
  type HaStatus,
} from '@/lib/desktop-ha'
import type { SmartHomeData } from '@/plugins/ha-mcp/overview'

import { SmartHomeClient } from './smart-home-client'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type BridgeOptions = {
  available?: () => Promise<boolean>
  status?: () => Promise<HaStatus>
  getStates?: () => Promise<HaEntityState[]>
  callService?: (input: HaCallServiceInput) => Promise<{ ok: boolean; error?: string }>
  openSettings?: () => Promise<void>
}

function installBridge(options: BridgeOptions = {}) {
  const ha = {
    available: vi.fn(options.available ?? (async () => true)),
    status: vi.fn(
      options.status ??
        (async (): Promise<HaStatus> => ({
          configured: true,
          baseUrl: 'http://homeassistant.local:8123',
          connected: true,
          version: '2025.1.0',
        })),
    ),
    discover: vi.fn(async () => []),
    configure: vi.fn(async () => ({ ok: true })),
    clear: vi.fn(async () => ({ ok: true as const })),
    getStates: vi.fn(options.getStates ?? (async () => [])),
    callService: vi.fn(options.callService ?? (async () => ({ ok: true }))),
  }
  const openSettings = vi.fn(options.openSettings ?? (async () => {}))
  ;(window as unknown as { fanmengDesktop?: unknown }).fanmengDesktop = {
    isDesktop: true,
    ha,
    openSettings,
  }
  return { ha, openSettings }
}

const serverData: SmartHomeData = {
  configured: true,
  totalEntities: 1,
  activeEntities: 1,
  areas: [{ name: '服务器区域', entityCount: 1 }],
  entities: [
    {
      entityId: 'light.server_lamp',
      name: '服务器灯',
      area: '服务器区域',
      domain: 'light',
      state: 'on',
      active: true,
    },
  ],
  health: null,
}

const serverUnconfiguredData: SmartHomeData = {
  configured: false,
  hint: '服务器提示：请先在服务器配置 Home Assistant。',
}

const configuredStatus: HaStatus = {
  configured: true,
  baseUrl: 'http://homeassistant.local:8123',
  connected: true,
  version: '2025.1.0',
}

function state(
  entityId: string,
  value: string,
  attributes: Record<string, unknown> = {},
): HaEntityState {
  return { entityId, state: value, attributes, lastChanged: '2026-11-17T10:00:00Z' }
}

const livingLight = state('light.living_room', 'on', { friendly_name: '客厅灯', area_name: '客厅' })
const temperatureSensor = state('sensor.temperature', '23.5', {
  friendly_name: '温度传感器',
  area_name: '客厅',
  device_class: 'temperature',
  unit_of_measurement: '°C',
})
const humiditySensor = state('sensor.humidity', '48', {
  friendly_name: '湿度传感器',
  device_class: 'humidity',
  unit_of_measurement: '%',
})
const offlineLight = state('light.broken', 'unavailable', { friendly_name: '坏掉的灯' })

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  window.localStorage.clear()
})

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  container.remove()
  delete (window as unknown as { fanmengDesktop?: unknown }).fanmengDesktop
  window.localStorage.clear()
})

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function render(data: SmartHomeData) {
  await act(async () => {
    root.render(React.createElement(SmartHomeClient, { data }))
  })
  await settle()
  await settle()
}

async function click(testId: string) {
  const button = container.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)
  expect(button, `找不到按钮 ${testId}`).not.toBeNull()
  await act(async () => {
    button!.click()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  await settle()
}

function testIds(prefix: string): (string | null)[] {
  return [...container.querySelectorAll(`[data-testid^="${prefix}"]`)].map((element) =>
    element.getAttribute('data-testid'),
  )
}

describe('SmartHomeClient 桌面桥分支', () => {
  it('无桥时完全回退服务器数据', async () => {
    await render(serverData)

    expect(container.textContent).toContain('服务器灯')
    expect(container.textContent).toContain('服务器区域')
    expect(container.textContent).not.toContain('客户端还没有连接 Home Assistant')
    expect(container.querySelector('[data-testid="ha-open-settings"]')).toBeNull()
  })

  it('有桥但未配置：显示客户端空态 + 去设置，不显示服务器数据', async () => {
    const { openSettings } = installBridge({
      status: async () => ({
        configured: false,
        baseUrl: null,
        connected: false,
      }),
    })

    await render(serverData)

    expect(container.textContent).toContain('客户端还没有连接 Home Assistant')
    expect(container.textContent).not.toContain('服务器灯')

    await click('ha-open-settings')
    expect(openSettings).toHaveBeenCalledTimes(1)
  })

  it('已配置时渲染 getStates 的实时实体与连接信息', async () => {
    installBridge({
      status: async () => configuredStatus,
      getStates: async () => [livingLight, temperatureSensor],
    })

    await render(serverData)

    expect(container.textContent).toContain('客厅灯')
    expect(container.textContent).toContain('温度传感器')
    expect(container.textContent).toContain('已连接')
    expect(container.textContent).toContain('HA 2025.1.0')
    expect(container.textContent).toContain('最后更新')
    expect(container.querySelector('[data-testid="ha-refresh"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="ha-open-settings"]')).not.toBeNull()
    expect(container.textContent).not.toContain('服务器灯')
  })

  it('汇总按可控设备 / 离线 / 环境读数统计，不再显示区域或实体总数', async () => {
    installBridge({
      status: async () => configuredStatus,
      getStates: async () => [livingLight, temperatureSensor, humiditySensor, offlineLight],
    })

    await render(serverData)

    expect(container.querySelector('[data-testid="ha-stat-areas"]')).toBeNull()
    expect(container.querySelector('[data-testid="ha-stat-total"]')).toBeNull()
    expect(container.querySelector('[data-testid="ha-stat-active"]')).toBeNull()

    const controllable = container.querySelector('[data-testid="ha-stat-controllable"]')
    expect(controllable?.textContent).toContain('可控设备')
    expect(controllable?.textContent).toContain('开启 1')

    const offline = container.querySelector('[data-testid="ha-stat-offline"]')
    expect(offline?.textContent).toContain('1')
    expect(offline?.textContent).toContain('不可用或未知')

    const sensors = container.querySelector('[data-testid="ha-stat-sensors"]')
    expect(sensors?.textContent).toContain('2')
    expect(sensors?.textContent).toContain('温度 · 湿度')
  })

  it('connected=false 时直接错误态，不再调用 getStates，错误原因可见', async () => {
    const { ha } = installBridge({
      status: async () => ({
        configured: true,
        baseUrl: 'http://10.0.0.110:8123',
        connected: false,
        error: '令牌无效或已过期，请重新生成长期访问令牌',
      }),
    })

    await render(serverData)

    expect(ha.getStates).not.toHaveBeenCalled()
    expect(container.textContent).toContain('连接失败')
    expect(container.textContent).toContain('令牌无效或已过期')
    expect(container.querySelector('[data-testid="ha-retry"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="ha-open-settings"]')).not.toBeNull()
    expect(container.textContent).not.toContain('服务器灯')
  })

  it('connected=false 且没有 error 时给出默认检查提示', async () => {
    const { ha } = installBridge({
      status: async () => ({
        configured: true,
        baseUrl: 'http://10.0.0.110:8123',
        connected: false,
      }),
    })

    await render(serverData)

    expect(ha.getStates).not.toHaveBeenCalled()
    expect(container.textContent).toContain('无法连接 Home Assistant，请检查地址或令牌。')
  })

  it('3000 个实体时首屏有界，展开全部设备后每次最多 30 行', async () => {
    const entities: HaEntityState[] = []
    const domains = ['light', 'switch', 'cover', 'climate', 'sensor']
    for (let index = 0; index < 3000; index += 1) {
      const domain = domains[index % domains.length]
      entities.push(
        state(`${domain}.bulk_${index}`, domain === 'sensor' ? '21' : 'on', {
          friendly_name: `设备${index}`,
        }),
      )
    }

    installBridge({
      status: async () => configuredStatus,
      getStates: async () => entities,
    })

    await render(serverData)

    expect(testIds('ha-device-').length).toBeGreaterThan(0)
    expect(testIds('ha-device-').length).toBeLessThanOrEqual(24)
    expect(testIds('ha-row-')).toHaveLength(0)
    expect(container.textContent).toContain('全部设备（3000）')

    await click('ha-all-devices-toggle')

    const rows = testIds('ha-row-')
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.length).toBeLessThanOrEqual(30)
    expect(container.textContent).toContain('显示更多（剩余 2970）')
  })

  it('温湿度 sensor 出现在环境读数，且没有控制按钮', async () => {
    installBridge({
      status: async () => configuredStatus,
      getStates: async () => [livingLight, temperatureSensor, humiditySensor],
    })

    await render(serverData)

    const temperature = container.querySelector('[data-testid="ha-reading-sensor.temperature"]')
    const humidity = container.querySelector('[data-testid="ha-reading-sensor.humidity"]')
    expect(temperature?.textContent).toContain('温度传感器')
    expect(temperature?.textContent).toContain('23.5')
    expect(temperature?.textContent).toContain('°C')
    expect(humidity?.textContent).toContain('湿度传感器')
    expect(humidity?.textContent).toContain('48')
    expect(humidity?.textContent).toContain('%')
    expect(temperature?.querySelector('button')).toBeNull()
    expect(
      container.querySelector('[data-testid="ha-control-sensor.temperature-toggle"]'),
    ).toBeNull()
  })

  it('电池传感器不会进入环境读数', async () => {
    const battery = state('sensor.battery_level', '87', {
      friendly_name: '门锁电量',
      device_class: 'battery',
      unit_of_measurement: '%',
    })
    const batteryWithoutClass = state('sensor.front_door_battery', '87', {
      friendly_name: '前门电量',
      unit_of_measurement: '%',
    })
    installBridge({
      status: async () => configuredStatus,
      getStates: async () => [livingLight, battery, batteryWithoutClass, humiditySensor],
    })

    await render(serverData)

    expect(container.querySelector('[data-testid="ha-reading-sensor.battery_level"]')).toBeNull()
    expect(
      container.querySelector('[data-testid="ha-reading-sensor.front_door_battery"]'),
    ).toBeNull()
    expect(container.querySelector('[data-testid="ha-reading-sensor.humidity"]')).not.toBeNull()
    const sensors = container.querySelector('[data-testid="ha-stat-sensors"]')
    expect(sensors?.textContent).toContain('1')
  })

  it('缺失温度 / 位置时不显示成 0', async () => {
    const cover = state('cover.no_position', 'closed', { friendly_name: '无位置窗帘' })
    const climate = state('climate.no_temperature', 'off', { friendly_name: '无温度空调' })
    installBridge({
      status: async () => configuredStatus,
      getStates: async () => [cover, climate],
    })

    await render(serverData)

    const coverCard = container.querySelector('[data-testid="ha-device-cover.no_position"]')
    expect(coverCard?.textContent).toContain('位置 —')
    expect(coverCard?.textContent).not.toContain('位置 0%')

    const climateCard = container.querySelector('[data-testid="ha-device-climate.no_temperature"]')
    expect(climateCard?.textContent).not.toContain('0°C')
    expect(climateCard?.textContent).toContain('关闭')

    const tempUp = container.querySelector<HTMLButtonElement>(
      '[data-testid="ha-control-climate.no_temperature-temp-up"]',
    )
    expect(tempUp?.disabled).toBe(true)
  })

  it('unavailable / unknown 实体出现在「需要处理」', async () => {
    installBridge({
      status: async () => configuredStatus,
      getStates: async () => [
        livingLight,
        offlineLight,
        state('switch.ghost', 'unknown', { friendly_name: '未知开关' }),
      ],
    })

    await render(serverData)

    const offline = container.querySelector('[data-testid="ha-attention-light.broken"]')
    const unknown = container.querySelector('[data-testid="ha-attention-switch.ghost"]')
    expect(offline?.textContent).toContain('坏掉的灯')
    expect(offline?.textContent).toContain('不可用')
    expect(unknown?.textContent).toContain('未知开关')
    expect(unknown?.textContent).toContain('未知')
    expect(container.textContent).toContain('需要处理')
  })

  it('「显示其余 N 个」能展开被截断的设备', async () => {
    const lights = Array.from({ length: 8 }, (_, index) =>
      state(`light.room_${index}`, 'on', { friendly_name: `灯${index}` }),
    )
    installBridge({
      status: async () => configuredStatus,
      getStates: async () => lights,
    })

    await render(serverData)

    expect(testIds('ha-device-').length).toBe(6)
    expect(container.textContent).toContain('显示其余 2 个')

    await click('ha-group-more-light')

    expect(testIds('ha-device-').length).toBe(8)
    expect(container.textContent).not.toContain('显示其余 2 个')
  })

  it('刷新期间保留旧数据与展开状态，成功后就地替换', async () => {
    const lights = Array.from({ length: 8 }, (_, index) =>
      state(`light.room_${index}`, 'on', { friendly_name: `灯${index}` }),
    )
    let resolveRefresh!: (value: HaEntityState[]) => void
    const pendingRefresh = new Promise<HaEntityState[]>((resolve) => {
      resolveRefresh = resolve
    })
    const getStates = vi
      .fn<() => Promise<HaEntityState[]>>()
      .mockResolvedValueOnce(lights)
      .mockImplementationOnce(() => pendingRefresh)
    installBridge({ status: async () => configuredStatus, getStates })

    await render(serverData)
    await click('ha-group-more-light')
    await click('ha-all-devices-toggle')

    expect(testIds('ha-device-')).toHaveLength(8)
    expect(testIds('ha-row-')).toHaveLength(8)

    await click('ha-refresh')

    // 刷新还在进行：不进入 LoadingView，旧卡片和展开/分页状态都在
    expect(container.textContent).not.toContain('正在连接 Home Assistant…')
    expect(testIds('ha-device-')).toHaveLength(8)
    expect(testIds('ha-row-')).toHaveLength(8)

    await act(async () => {
      resolveRefresh([...lights, state('light.new', 'on', { friendly_name: '新灯' })])
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await settle()

    expect(testIds('ha-device-')).toHaveLength(9)
    expect(testIds('ha-row-')).toHaveLength(9)
  })

  it('刷新失败保留上一份数据，并在连接条就地提示', async () => {
    const getStates = vi
      .fn<() => Promise<HaEntityState[]>>()
      .mockResolvedValueOnce([livingLight])
      .mockRejectedValueOnce(new Error('boom'))
    installBridge({ status: async () => configuredStatus, getStates })

    await render(serverData)
    expect(testIds('ha-device-')).toHaveLength(1)

    await click('ha-refresh')

    expect(testIds('ha-device-')).toHaveLength(1)
    expect(container.textContent).toContain('刷新失败：')
    expect(container.textContent).toContain('无法读取 Home Assistant 实体状态')
    expect(container.textContent).not.toContain('无法读取 Home Assistant 数据')
  })

  it('灯的开/关按钮调用正确参数，成功后重新 getStates', async () => {
    const { ha } = installBridge({
      status: async () => configuredStatus,
      getStates: vi.fn(async () => [livingLight]),
    })

    await render(serverData)
    await click('ha-control-light.living_room-toggle')

    expect(ha.callService).toHaveBeenCalledWith({
      domain: 'light',
      service: 'turn_off',
      entityId: 'light.living_room',
    })
    // 初次挂载一次 + 操作成功后刷新一次
    expect(ha.getStates).toHaveBeenCalledTimes(2)
  })

  it('操作 pending 时按钮禁用，重复点击不会重复 callService', async () => {
    let resolveAction!: (value: { ok: boolean }) => void
    const pendingAction = new Promise<{ ok: boolean }>((resolve) => {
      resolveAction = resolve
    })
    const { ha } = installBridge({
      status: async () => configuredStatus,
      getStates: vi.fn(async () => [livingLight]),
      callService: vi.fn(() => pendingAction),
    })

    await render(serverData)
    const button = container.querySelector<HTMLButtonElement>(
      '[data-testid="ha-control-light.living_room-toggle"]',
    )
    expect(button).not.toBeNull()

    await act(async () => {
      button!.click()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(button!.disabled).toBe(true)
    button!.click()
    await settle()
    expect(ha.callService).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveAction({ ok: true })
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    await settle()
  })

  it('窗帘位置和空调温度/模式调用正确参数', async () => {
    const cover = state('cover.bedroom_curtain', 'open', {
      friendly_name: '卧室窗帘',
      current_position: 50,
    })
    const climate = state('climate.living_room', 'heat', {
      friendly_name: '客厅空调',
      temperature: 22,
      current_temperature: 28,
      target_temp_step: 0.5,
      hvac_modes: ['off', 'heat', 'cool'],
    })
    const { ha } = installBridge({
      status: async () => configuredStatus,
      getStates: async () => [cover, climate],
    })

    await render(serverData)

    const climateCard = container.querySelector('[data-testid="ha-device-climate.living_room"]')
    // HA 的 temperature 是设定温度，current_temperature 才是实测温度
    expect(climateCard?.textContent).toContain('当前温度 28°C')
    expect(climateCard?.textContent).toContain('设定温度 22°C')

    await click('ha-control-cover.bedroom_curtain-position-up')
    expect(ha.callService).toHaveBeenCalledWith({
      domain: 'cover',
      service: 'set_cover_position',
      entityId: 'cover.bedroom_curtain',
      data: { position: 60 },
    })

    await click('ha-control-climate.living_room-temp-up')
    expect(ha.callService).toHaveBeenCalledWith({
      domain: 'climate',
      service: 'set_temperature',
      entityId: 'climate.living_room',
      data: { temperature: 22.5 },
    })

    await click('ha-control-climate.living_room-mode-cool')
    expect(ha.callService).toHaveBeenCalledWith({
      domain: 'climate',
      service: 'set_hvac_mode',
      entityId: 'climate.living_room',
      data: { hvac_mode: 'cool' },
    })
  })

  it('操作失败就地显示错误，不刷新出假状态', async () => {
    const { ha } = installBridge({
      status: async () => configuredStatus,
      getStates: vi.fn(async () => [livingLight]),
      callService: async () => ({ ok: false, error: '设备离线' }),
    })

    await render(serverData)
    await click('ha-control-light.living_room-toggle')

    const alert = container.querySelector('[role="alert"]')
    expect(alert?.textContent).toContain('设备离线')
    expect(ha.getStates).toHaveBeenCalledTimes(1)
    // 仍然是主进程返回的旧状态，没有乐观更新成关闭
    const card = container.querySelector('[data-testid="ha-device-light.living_room"]')
    expect(card?.textContent).toContain('开')
  })

  it('非白名单实体没有控制按钮', async () => {
    installBridge({
      status: async () => configuredStatus,
      getStates: async () => [livingLight, temperatureSensor],
    })

    await render(serverData)

    expect(
      container.querySelector('[data-testid="ha-control-sensor.temperature-toggle"]'),
    ).toBeNull()
    const controlIds = testIds('ha-control-')
    expect(controlIds).not.toContain('ha-control-sensor.temperature-toggle')
    expect(controlIds).toContain('ha-control-light.living_room-toggle')
  })

  it('桥对象缺方法（老客户端）时守卫返回 null，页面回退服务器数据', async () => {
    const ha = {
      available: vi.fn(async () => true),
      status: vi.fn(async () => configuredStatus),
      discover: vi.fn(async () => []),
      configure: vi.fn(async () => ({ ok: true })),
      clear: vi.fn(async () => ({ ok: true as const })),
      getStates: vi.fn(async () => [livingLight]),
      // 故意缺 callService
    }
    ;(window as unknown as { fanmengDesktop?: unknown }).fanmengDesktop = {
      isDesktop: true,
      ha,
      openSettings: vi.fn(async () => {}),
    }

    expect(getDesktopHa()).toBeNull()

    await render(serverData)
    expect(container.textContent).toContain('服务器灯')
    expect(container.textContent).not.toContain('客厅灯')
    expect(ha.available).not.toHaveBeenCalled()
  })

  it('桥调用抛错时回退服务器数据，不打崩页面', async () => {
    installBridge({
      available: async () => {
        throw new Error('bridge unavailable')
      },
    })

    await render(serverData)

    expect(container.textContent).toContain('服务器灯')
  })

  it('已配置但 getStates 抛错：明确错误态 + 去设置，不伪造数据', async () => {
    installBridge({
      status: async () => configuredStatus,
      getStates: async () => {
        throw new Error('unauthorized')
      },
    })

    await render(serverData)

    expect(container.textContent).toContain('无法读取 Home Assistant 数据')
    expect(container.textContent).not.toContain('服务器灯')
    expect(container.querySelector('[data-testid="ha-open-settings"]')).not.toBeNull()

    // 原因只在连接条出现一次，空态用通用说明
    const reason = '无法读取 Home Assistant 实体状态，请检查连接或令牌。'
    expect(container.textContent!.split(reason).length - 1).toBe(1)
  })

  it('错误态的「重试」会重新拉取 states 并恢复实时视图', async () => {
    let calls = 0
    const getStates = vi.fn(async () => {
      calls += 1
      if (calls === 1) throw new Error('unauthorized')
      return [livingLight]
    })
    const { ha } = installBridge({
      status: async () => configuredStatus,
      getStates,
    })

    await render(serverData)
    expect(container.textContent).toContain('无法读取 Home Assistant 数据')

    await click('ha-retry')

    expect(ha.getStates).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('客厅灯')
    expect(container.textContent).not.toContain('无法读取 Home Assistant 数据')
  })

  it('读数 / 需要处理超出上限时提示还有多少', async () => {
    const readings = Array.from({ length: 10 }, (_, index) =>
      state(`sensor.temp_${index}`, '20', {
        friendly_name: `温度${index}`,
        device_class: 'temperature',
        unit_of_measurement: '°C',
      }),
    )
    const offline = Array.from({ length: 22 }, (_, index) =>
      state(`light.off_${index}`, 'unavailable', { friendly_name: `离线灯${index}` }),
    )
    installBridge({
      status: async () => configuredStatus,
      getStates: async () => [...readings, ...offline],
    })

    await render(serverData)

    expect(testIds('ha-reading-')).toHaveLength(8)
    expect(container.textContent).toContain('还有 2 个读数未显示。')
    expect(testIds('ha-attention-')).toHaveLength(20)
    expect(container.textContent).toContain('还有 2 个未列出。')
  })

  it('置顶按 baseUrl 隔离', async () => {
    const { ha } = installBridge({
      status: async () => configuredStatus,
      getStates: async () => [livingLight],
    })

    await render(serverData)
    await click('ha-pin-light.living_room')

    const pin = () => container.querySelector('[data-testid="ha-pin-light.living_room"]')
    expect(pin()?.getAttribute('aria-label')).toBe('取消置顶 客厅灯')
    expect(window.localStorage.getItem('fmkj:ha:pins:http://homeassistant.local:8123')).toContain(
      'light.living_room',
    )

    ha.status.mockResolvedValue({
      configured: true,
      baseUrl: 'http://other.local:8123',
      connected: true,
      version: '2025.1.0',
    })
    await click('ha-refresh')

    expect(pin()?.getAttribute('aria-label')).toBe('置顶 客厅灯')
    expect(window.localStorage.getItem('fmkj:ha:pins:http://other.local:8123')).toBeNull()
  })

  it('服务器未配置且无桥时保持服务器空态', async () => {
    await render(serverUnconfiguredData)

    expect(container.textContent).toContain('还没有连接 Home Assistant')
    expect(container.textContent).toContain('服务器提示：请先在服务器配置 Home Assistant。')
  })
})
