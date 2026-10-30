'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUp, Blocks, Check, ChevronDown, Copy, FolderKanban, Plus, RotateCcw, Square, X } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type AiModelOption = { id: string; name: string; provider: string; tag: string; cost: number; reasoning?: boolean; description: string }
export type AiConnectablePlugin = { id: string; name: string; description: string; status: 'ready' | 'coming-soon'; enabled: boolean; where: string; provides: string[] }
export type AiProjectContext = { id: string; name: string; customerName: string | null; platform: string | null; pointCount: number }
export type AiToolCall = { pluginId: string; pluginName: string; action: string; summary: string; details: string[]; href?: string; hrefLabel?: string }
export type AiChatMessage = { id: string; role: 'user' | 'assistant'; content: string; createdAt: string; modelName?: string; cost?: number; reasoning?: string; toolCalls?: AiToolCall[]; error?: boolean }

/** 一条消息：用户消息右侧浅灰气泡，AI 回复为无边框正文（参考 ChatGPT / Claude）。 */
export function AiMessageBubble({ message, onRegenerate }: { message: AiChatMessage; onRegenerate?: () => void }) {
  const [copied, setCopied] = useState(false)
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl bg-muted px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap">{message.content}</div>
      </div>
    )
  }
  return (
    <div className="group flex flex-col gap-1.5">
      {message.toolCalls?.map((c, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Blocks className="size-3" />
          <span>{c.summary ? `${c.pluginName}：${c.summary}` : `已使用 ${c.pluginName}`}</span>
          {c.href ? (
            <Link href={c.href} className="underline-offset-4 hover:text-foreground hover:underline">
              {c.hrefLabel ?? '查看'}
            </Link>
          ) : null}
        </div>
      ))}
      <div className={cn('text-sm leading-relaxed whitespace-pre-wrap', message.error && 'rounded-xl border border-dashed px-3 py-2 text-muted-foreground')}>{message.content}</div>
      <div className="flex items-center gap-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          aria-label="复制"
          onClick={() => {
            void navigator.clipboard?.writeText(message.content)
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
          }}
          className="rounded-md p-1 hover:bg-muted hover:text-foreground"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </button>
        {onRegenerate ? (
          <button type="button" aria-label="重新生成" onClick={onRegenerate} className="rounded-md p-1 hover:bg-muted hover:text-foreground">
            <RotateCcw className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  )
}

/**
 * 极简输入框：一个圆角容器，上面是自动增高的文本框，下面一行左侧「+」和模型名，右侧发送按钮。
 * 插件、项目、模板都收进「+」菜单，平时不占位置。Enter 发送，Shift + Enter 换行。
 */
export function AiPromptComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  streaming,
  onStop,
  models,
  selectedModel,
  onSelectModel,
  plugins,
  connectedPluginIds,
  onTogglePlugin,
  projects,
  selectedProjectId,
  onSelectProject,
  templates,
  onPickTemplate,
}: {
  value: string
  onChange: (next: string) => void
  onSubmit: () => void
  disabled?: boolean
  streaming?: boolean
  onStop?: () => void
  models: AiModelOption[]
  selectedModel: AiModelOption
  onSelectModel: (modelId: string) => void
  plugins: AiConnectablePlugin[]
  connectedPluginIds: string[]
  onTogglePlugin: (pluginId: string) => void
  projects: AiProjectContext[]
  selectedProjectId: string | null
  onSelectProject: (projectId: string | null) => void
  templates?: { id: string; name: string }[]
  onPickTemplate?: (id: string) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const project = projects.find((p) => p.id === selectedProjectId) ?? null
  const usable = plugins.filter((p) => p.status === 'ready' && p.enabled)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  return (
    <div className="rounded-2xl border bg-background shadow-xs transition-shadow focus-within:shadow-sm">
      {project ? (
        <div className="px-3 pt-2.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <FolderKanban className="size-3" />
            {project.name}
            <button type="button" aria-label="取消关联项目" onClick={() => onSelectProject(null)} className="hover:text-foreground">
              <X className="size-3" />
            </button>
          </span>
        </div>
      ) : null}
      <textarea
        ref={ref}
        rows={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            onSubmit()
          }
        }}
        placeholder="有什么可以帮你？"
        className="block max-h-[200px] w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-sm outline-none placeholder:text-muted-foreground"
      />
      <div className="flex items-center justify-between gap-2 px-2 pb-2">
        <div className="flex items-center gap-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="更多" className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                <Plus className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
              {templates?.length && onPickTemplate ? (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>常用模板</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-56">
                    {templates.map((t) => (
                      <DropdownMenuItem key={t.id} onSelect={() => onPickTemplate(t.id)}>
                        {t.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ) : null}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>关联项目</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56">
                  <DropdownMenuItem onSelect={() => onSelectProject(null)}>不关联</DropdownMenuItem>
                  {projects.map((p) => (
                    <DropdownMenuItem key={p.id} onSelect={() => onSelectProject(p.id)}>
                      <span className="truncate">{p.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>插件</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56">
                  {usable.map((p) => (
                    <DropdownMenuCheckboxItem
                      key={p.id}
                      checked={connectedPluginIds.includes(p.id)}
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={() => onTogglePlugin(p.id)}
                    >
                      {p.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/plugins">管理插件</Link>
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                {selectedModel.name}
                <ChevronDown className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-60">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">模型</DropdownMenuLabel>
              {models.map((m) => (
                <DropdownMenuItem key={m.id} onSelect={() => onSelectModel(m.id)} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm">{m.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{m.tag} · {m.cost} 积分</div>
                  </div>
                  {m.id === selectedModel.id ? <Check className="size-3.5 shrink-0" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {streaming ? (
          <button type="button" aria-label="停止" onClick={onStop} className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Square className="size-3 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="发送"
            disabled={disabled || !value.trim()}
            onClick={onSubmit}
            className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-30"
          >
            <ArrowUp className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}
