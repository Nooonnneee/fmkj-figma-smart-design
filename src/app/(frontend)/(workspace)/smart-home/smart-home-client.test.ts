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

import type { HaCallServiceInput, HaEntityState, HaStatus } from '@/lib/desktop-ha'
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
})

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  container.remove()
  delete (window as unknown as { fanmengDesktop?: unknown }).fanmengDesktop
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

  it('已配置时渲染 getStates 的实时实体，替掉服务器数据', async () => {
    installBridge({
      status: async () => configuredStatus,
      getStates: async () => [livingLight, temperatureSensor],
    })

    await render(serverData)

    expect(container.textContent).toContain('客厅灯')
    expect(container.textContent).toContain('温度传感器')
    expect(container.textContent).toContain('桌面客户端直连')
    expect(container.textContent).not.toContain('服务器灯')
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

  it('窗帘位置和空调温度/模式调用正确参数', async () => {
    const cover = state('cover.bedroom_curtain', 'open', {
      friendly_name: '卧室窗帘',
      current_position: 50,
    })
    const climate = state('climate.living_room', 'heat', {
      friendly_name: '客厅空调',
      temperature: 22,
      target_temp_step: 0.5,
      hvac_modes: ['off', 'heat', 'cool'],
    })
    const { ha } = installBridge({
      status: async () => configuredStatus,
      getStates: async () => [cover, climate],
    })

    await render(serverData)

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
    // 仍然是主进程返回的旧状态，没有乐观更新成 off
    expect(container.textContent).toContain('on')
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
    const controlIds = [...container.querySelectorAll('[data-testid^="ha-control-"]')].map((el) =>
      el.getAttribute('data-testid'),
    )
    expect(controlIds).not.toContain('ha-control-sensor.temperature-toggle')
    expect(controlIds).toContain('ha-control-light.living_room-toggle')
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
  })

  it('服务器未配置且无桥时保持服务器空态', async () => {
    await render(serverUnconfiguredData)

    expect(container.textContent).toContain('还没有连接 Home Assistant')
    expect(container.textContent).toContain('服务器提示：请先在服务器配置 Home Assistant。')
  })
})
