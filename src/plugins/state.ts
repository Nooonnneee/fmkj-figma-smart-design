import { getCompanyInfo } from '@/lib/cached-data'

import { PLUGINS, type PluginId } from '.'

export type PluginFlags = Record<PluginId, boolean>

/** 各插件当前是否启用（服务端读取；设置里关闭的插件为 false，新安装的插件默认开启）。 */
export async function getPluginFlags(): Promise<PluginFlags> {
  const { disabledPlugins } = await getCompanyInfo()
  const disabled = new Set(disabledPlugins)
  return Object.fromEntries(PLUGINS.map((p) => [p.id, p.status === 'ready' && !disabled.has(p.id)])) as PluginFlags
}
