'use client'

import { useState } from 'react'
import { Bot, Check, Plus, Sparkles, Star, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  AI_PROVIDER_CHANNEL_LIST,
  AI_PROVIDER_CHANNELS,
  AI_PROVIDER_PRESETS,
  type AiModelConfig,
  type AiProviderChannelId,
} from '@/plugins/ai-copilot/templates'

function makeModelId(apiModel: string, existingIds: Set<string>): string {
  const base =
    apiModel
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'custom-model'
  if (!existingIds.has(base)) return base
  let i = 2
  while (existingIds.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}

export function AiModelSettings({
  initialModels,
  envStatus,
}: {
  initialModels: AiModelConfig[]
  envStatus: Record<string, boolean>
}) {
  const [models, setModels] = useState<AiModelConfig[]>(initialModels)

  const updateModel = (id: string, patch: Partial<AiModelConfig>) => {
    setModels((prev) =>
      prev.map((m) => {
        if (m.id !== id) return patch.isDefault ? { ...m, isDefault: false } : m
        const next = { ...m, ...patch }
        if (patch.enabled === false && next.isDefault) {
          next.isDefault = false
        }
        return next
      }),
    )
  }

  const setDefault = (id: string) => {
    setModels((prev) => prev.map((m) => ({ ...m, isDefault: m.id === id, ...(m.id === id ? { enabled: true } : {}) })))
  }

  const removeModel = (id: string) => {
    setModels((prev) => {
      if (prev.length <= 1) return prev
      const next = prev.filter((m) => m.id !== id)
      if (!next.some((m) => m.enabled)) next[0].enabled = true
      if (!next.some((m) => m.enabled && m.isDefault)) {
        const firstEnabled = next.find((m) => m.enabled) ?? next[0]
        firstEnabled.isDefault = true
      }
      return [...next]
    })
  }

  const addPreset = (preset: (typeof AI_PROVIDER_PRESETS)[number]) => {
    setModels((prev) => {
      const ids = new Set(prev.map((m) => m.id))
      const id = makeModelId(preset.apiModel, ids)
      return [
        ...prev,
        {
          ...preset,
          id,
          enabled: true,
          isDefault: prev.length === 0,
        },
      ]
    })
  }

  const addBlank = () => {
    setModels((prev) => {
      const ids = new Set(prev.map((m) => m.id))
      const id = makeModelId('custom-ai', ids)
      return [
        ...prev,
        {
          id,
          name: '自定义 AI 模型',
          provider: AI_PROVIDER_CHANNELS.newapi.label,
          channelId: 'newapi',
          tag: '自定义',
          cost: 1,
          description: '支持任意兼容 OpenAI /v1/chat/completions 协议的官方接口或聚合网关',
          apiModel: 'gpt-4o-mini',
          baseUrl: AI_PROVIDER_CHANNELS.newapi.baseUrl,
          apiKeyEnv: AI_PROVIDER_CHANNELS.newapi.apiKeyEnv,
          reasoning: false,
          enabled: true,
          isDefault: false,
        },
      ]
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-5 text-primary" />
              AI 模型与接口配置
            </CardTitle>
            <CardDescription>
              同时支持各厂商官方 API（DeepSeek、阿里百炼、火山豆包、Kimi）与 NewAPI / OneAPI / 硅基流动等 OpenAI 兼容聚合网关。启用后的模型会实时出现在网页侧边栏与小程序的 AI 模型切换列表中。
            </CardDescription>
          </div>
          <Badge variant="outline" className="tabular-nums">
            已启用 {models.filter((m) => m.enabled).length} / {models.length} 个模型
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <input type="hidden" name="aiModelsJson" value={JSON.stringify(models)} />

        {/* 一键添加常用渠道模板 */}
        <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-foreground">快速添加常用官方 API 或聚合网关模型</span>
            <Button type="button" variant="outline" size="xs" onClick={addBlank}>
              <Plus className="size-3.5" />
              空白自定义模型
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {AI_PROVIDER_PRESETS.map((preset) => (
              <Button
                key={`${preset.provider}-${preset.apiModel}`}
                type="button"
                variant="outline"
                size="xs"
                className="h-7 bg-background text-xs font-normal"
                onClick={() => addPreset(preset)}
              >
                <Plus className="size-3 text-muted-foreground" />
                {preset.name}
              </Button>
            ))}
          </div>
        </div>

        {/* 模型卡片列表 */}
        <div className="space-y-3">
          {models.map((m, idx) => {
            const channel = AI_PROVIDER_CHANNELS[m.channelId] ?? AI_PROVIDER_CHANNELS.deepseek
            const keyReady = Boolean(envStatus[channel.id])
            return (
              <div
                key={m.id}
                className={cn(
                  'space-y-3 rounded-xl border p-4 transition-colors',
                  !m.enabled && 'bg-muted/25 opacity-75',
                  m.isDefault && m.enabled && 'border-primary/40 bg-primary/[0.02]',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-semibold">{m.name || '未命名模型'}</span>
                    <Badge variant="outline" className="text-[11px]">
                      {channel.label}
                    </Badge>
                    {m.isDefault ? (
                      <Badge variant="default" className="gap-1 text-[11px]">
                        <Star className="size-3 fill-current" />
                        默认模型
                      </Badge>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setDefault(m.id)}
                      >
                        设为默认
                      </Button>
                    )}
                    {keyReady ? (
                      <Badge variant="success" className="gap-1 text-[11px]">
                        <Check className="size-3" />
                        密钥已就绪（{channel.apiKeyEnv}）
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[11px] text-muted-foreground">
                        待配环境变量：{channel.id === 'newapi' ? 'NEWAPI_BASE_URL + NEWAPI_API_KEY' : channel.apiKeyEnv}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor={`ai-enable-${m.id}`} className="text-xs text-muted-foreground">
                        {m.enabled ? '已启用' : '已停用'}
                      </Label>
                      <Switch
                        id={`ai-enable-${m.id}`}
                        checked={m.enabled}
                        onCheckedChange={(checked) => updateModel(m.id, { enabled: checked })}
                      />
                    </div>
                    {models.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`删除 ${m.name}`}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeModel(m.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">显示名称</Label>
                    <Input
                      value={m.name}
                      maxLength={80}
                      placeholder="如：DeepSeek V3 / GPT-4o"
                      onChange={(e) => updateModel(m.id, { name: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">接口渠道（服务端固定绑定域名与密钥）</Label>
                    <Select
                      value={m.channelId}
                      onValueChange={(v) => {
                        const ch = AI_PROVIDER_CHANNELS[v as AiProviderChannelId] ?? AI_PROVIDER_CHANNELS.deepseek
                        updateModel(m.id, {
                          channelId: ch.id,
                          provider: ch.label,
                          baseUrl: ch.baseUrl,
                          apiKeyEnv: ch.apiKeyEnv,
                        })
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AI_PROVIDER_CHANNEL_LIST.map((ch) => (
                          <SelectItem key={ch.id} value={ch.id}>
                            {ch.label}（{ch.apiKeyEnv}）
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">接口模型标识（model 参数）</Label>
                    <Input
                      value={m.apiModel}
                      maxLength={120}
                      placeholder="如：deepseek-chat、gpt-4o、qwen-plus"
                      onChange={(e) => updateModel(m.id, { apiModel: e.target.value })}
                      className="h-8 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_0.6fr]">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">服务端绑定接口地址（只读）</Label>
                    <Input
                      readOnly
                      value={channel.id === 'newapi' ? '由服务端环境变量 NEWAPI_BASE_URL 指定' : `${channel.baseUrl}/chat/completions`}
                      className="h-8 bg-muted/50 font-mono text-xs text-muted-foreground"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">绑定密钥环境变量（只读）</Label>
                    <Input
                      readOnly
                      value={channel.id === 'newapi' ? 'NEWAPI_API_KEY' : channel.apiKeyEnv}
                      className="h-8 bg-muted/50 font-mono text-xs text-muted-foreground"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">单次消耗积分</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={m.cost}
                      onChange={(e) => updateModel(m.id, { cost: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                      className="h-8 text-xs tabular-nums"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_1.5fr_auto] sm:items-center">
                  <div className="grid gap-1.5">
                    <Label className="text-xs">展示标签</Label>
                    <Input
                      value={m.tag}
                      maxLength={40}
                      placeholder="如：聚合网关 · 工具调用"
                      onChange={(e) => updateModel(m.id, { tag: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">简介说明</Label>
                    <Input
                      value={m.description}
                      maxLength={200}
                      placeholder="在模型选择列表中显示的简短说明"
                      onChange={(e) => updateModel(m.id, { description: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <Label className="flex cursor-pointer items-center gap-2 pt-4 text-xs font-normal">
                    <Checkbox
                      checked={Boolean(m.reasoning)}
                      onCheckedChange={(v) => updateModel(m.id, { reasoning: v === true })}
                    />
                    <Sparkles className="size-3.5 text-muted-foreground" />
                    支持思考过程（R1 等推理模型）
                  </Label>
                </div>
              </div>
            )
          })}
        </div>

        <div className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">使用说明（官方 API 与 NewAPI 聚合网关通用）：</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            <li>
              <strong>使用 NewAPI / OneAPI 聚合网关</strong>：在服务端环境变量中配置 <code className="rounded bg-muted px-1">NEWAPI_BASE_URL</code>（如 <code className="rounded bg-muted px-1">https://api.your-newapi.com/v1</code>）和 <code className="rounded bg-muted px-1">NEWAPI_API_KEY</code>，然后在上方选择「NewAPI / OneAPI 聚合网关」渠道并填写不同的「接口模型标识（model 参数）」即可一键切换多个模型。
            </li>
            <li>
              <strong>使用各家官方 API</strong>：点击上方预设按钮即可自动带出 DeepSeek、阿里百炼、火山方舟、Kimi 等官方接口地址，在环境变量中配置对应的 API Key 后保存即可生效。
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
