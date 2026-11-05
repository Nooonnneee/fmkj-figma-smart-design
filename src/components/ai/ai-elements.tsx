'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUp, Blocks, Check, ChevronDown, Copy, FileCode2, FileText, FolderKanban, ImageIcon, Loader2, Paperclip, Plus, RotateCcw, Square, Upload, X } from 'lucide-react'

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

export type AiModelOption = {
  id: string
  name: string
  provider: string
  tag: string
  cost: number
  reasoning?: boolean
  description: string
  minTier?: 'free' | 'pro' | 'team'
  tierBadge?: 'Go' | 'Plus' | 'Pro'
}
export type AiConnectablePlugin = { id: string; name: string; description: string; status: 'ready' | 'coming-soon'; enabled: boolean; where: string; provides: string[] }
export type AiProjectContext = { id: string; name: string; customerName: string | null; platform: string | null; pointCount: number }
export type AiToolCall = { pluginId: string; pluginName: string; action: string; summary: string; details: string[]; href?: string; hrefLabel?: string }
export type AiAttachment = {
  id: string
  name: string
  kind: 'image' | 'json' | 'text'
  size: number
  status: 'uploading' | 'ready' | 'error'
  /** 图片上传后的媒体库 URL 或本地预览 URL */
  url?: string
  mediaId?: string
  /** 图片上传时服务端 CAD 符号检测器真实识别到的点位（无识别则为空数组） */
  detectedPoints?: { type: string; x: number; y: number }[]
  /** 文本或 JSON 文件解析后的内容 */
  textContent?: string
  summary?: string
  error?: string
}
export type AiChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  modelName?: string
  cost?: number
  reasoning?: string
  toolCalls?: AiToolCall[]
  attachments?: Pick<AiAttachment, 'id' | 'name' | 'kind' | 'url' | 'summary'>[]
  error?: boolean
}

/** 从历史消息文本中分离出用户可见正文与附带的附件摘要（兼容刷新后从数据库读取的历史消息） */
function parseStoredUserContent(raw: string): { text: string; fileBadges: { name: string; kind: string; url?: string }[] } {
  const marker = '\n\n【已上传附件】'
  const idx = raw.indexOf(marker)
  if (idx === -1) return { text: raw, fileBadges: [] }
  const visible = raw.slice(0, idx).trim()
  const rest = raw.slice(idx + marker.length)
  const badges: { name: string; kind: string; url?: string }[] = []
  for (const line of rest.split('\n')) {
    const imgMatch = /^- \[图片\] ([^\s(]+).*?URL:\s*(\/api\/media\/file\/[^\s,)]+)/.exec(line)
    if (imgMatch) {
      badges.push({ name: imgMatch[1], kind: 'image', url: imgMatch[2] })
      continue
    }
    const fileMatch = /^- \[(JSON|文本清单)\] ([^\s(]+)/.exec(line)
    if (fileMatch) {
      badges.push({ name: fileMatch[2], kind: fileMatch[1] === 'JSON' ? 'json' : 'text' })
    }
  }
  return { text: visible, fileBadges: badges }
}

/** 一条消息：用户消息右侧浅灰气泡，AI 回复为无边框正文（参考 ChatGPT / Claude），支持底部快捷跟进胶囊。 */
export function AiMessageBubble({
  message,
  onRegenerate,
  onQuickAction,
}: {
  message: AiChatMessage
  onRegenerate?: () => void
  onQuickAction?: (prompt: string) => void
}) {
  const [copied, setCopied] = useState(false)
  if (message.role === 'user') {
    const parsed = parseStoredUserContent(message.content)
    const items =
      message.attachments?.map((a) => ({ name: a.name, kind: a.kind, url: a.url })) ??
      parsed.fileBadges
    return (
      <div className="flex justify-end">
        <div className="flex max-w-[85%] flex-col items-end gap-1.5">
          {items.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-1.5">
              {items.map((att, i) => (
                <div
                  key={`${att.name}-${i}`}
                  className="flex items-center gap-2 rounded-xl border bg-background px-2.5 py-1.5 text-xs shadow-2xs"
                >
                  {att.kind === 'image' && att.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={att.url} alt={att.name} className="size-8 rounded object-cover" />
                  ) : att.kind === 'json' ? (
                    <FileCode2 className="size-4 shrink-0 text-primary" />
                  ) : (
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="max-w-40 truncate font-medium">{att.name}</span>
                </div>
              ))}
            </div>
          ) : null}
          {parsed.text ? (
            <div className="rounded-2xl bg-muted px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap">{parsed.text}</div>
          ) : null}
        </div>
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
      {onQuickAction && !message.error && message.toolCalls?.some((c) => c.href?.includes('/point-map') || /户型图|图纸/.test(c.pluginName)) ? (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onQuickAction('请对当前项目的户型图重新生成点位，仅导入开关点位（importMode=switches, replaceExisting=true）')}
            className="rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
          >
            仅导入开关
          </button>
          <button
            type="button"
            onClick={() => onQuickAction('请对当前项目的户型图重新生成点位，导入全部开关与灯具点位（importMode=all, replaceExisting=true）')}
            className="rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
          >
            导入全部（含灯具）
          </button>
          <button
            type="button"
            onClick={() => onQuickAction('请重新读取并识别当前项目的户型图点位（redetect=true, replaceExisting=true）')}
            className="rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
          >
            重新识别图纸
          </button>
          <button
            type="button"
            onClick={() => onQuickAction('请按标准档为当前项目一键智能选型，并直接生成报价单')}
            className="rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
          >
            智能选型并出报价
          </button>
        </div>
      ) : null}
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {message.modelName ? (
          <span className="rounded bg-muted/70 px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {message.modelName}
            {typeof message.cost === 'number' && message.cost > 0 ? ` · ${message.cost}积分` : ''}
          </span>
        ) : null}
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
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
    </div>
  )
}

/**
 * 极简输入框：一个圆角容器，上面是自动增高的文本框，下面一行左侧「+」和模型名，右侧发送按钮。
 * 支持直接拖入文件上传（Drag & Drop）、Ctrl+V 粘贴上传或点击回形针上传。Enter 发送，Shift + Enter 换行。
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
  attachments = [],
  onAddFiles,
  onRemoveAttachment,
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
  attachments?: AiAttachment[]
  onAddFiles?: (files: FileList | File[]) => void
  onRemoveAttachment?: (id: string) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const project = projects.find((p) => p.id === selectedProjectId) ?? null
  const usable = plugins.filter((p) => p.status === 'ready' && p.enabled)
  const uploading = attachments.some((a) => a.status === 'uploading')
  const readyAttachments = attachments.filter((a) => a.status === 'ready')
  const canSend = !disabled && !uploading && (Boolean(value.trim()) || readyAttachments.length > 0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  return (
    <div
      onDragOver={(e) => {
        if (!e.dataTransfer?.types?.includes('Files')) return
        e.preventDefault()
        e.stopPropagation()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        setDragging(false)
      }}
      onDrop={(e) => {
        if (!e.dataTransfer?.files?.length) return
        e.preventDefault()
        e.stopPropagation()
        setDragging(false)
        onAddFiles?.(e.dataTransfer.files)
      }}
      className={cn(
        'relative rounded-2xl border bg-background shadow-xs transition-all focus-within:shadow-sm',
        dragging && 'border-primary bg-primary/5 ring-2 ring-primary/25',
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".png,.jpg,.jpeg,.webp,.dxf,.json,.csv,.txt,.md,.excalidraw"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onAddFiles?.(e.target.files)
          e.target.value = ''
        }}
      />

      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-2xl bg-background/95 text-xs font-medium text-primary">
          <Upload className="size-4" />
          <span>松开上传户型图、JSON 或清单</span>
        </div>
      ) : null}

      {project || attachments.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2.5">
          {project ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <FolderKanban className="size-3" />
              {project.name}
              <button type="button" aria-label="取消关联项目" onClick={() => onSelectProject(null)} className="hover:text-foreground">
                <X className="size-3" />
              </button>
            </span>
          ) : null}
          {attachments.map((att) => (
            <span
              key={att.id}
              className={cn(
                'inline-flex max-w-full items-center gap-1.5 rounded-lg border bg-muted/50 px-2 py-1 text-xs',
                att.status === 'error' && 'border-destructive/40 bg-destructive/10 text-destructive',
              )}
            >
              {att.status === 'uploading' ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
              ) : att.kind === 'image' && att.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={att.url} alt={att.name} className="size-5 shrink-0 rounded object-cover" />
              ) : att.kind === 'image' ? (
                <ImageIcon className="size-3.5 shrink-0 text-primary" />
              ) : att.kind === 'json' ? (
                <FileCode2 className="size-3.5 shrink-0 text-primary" />
              ) : (
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="max-w-36 truncate font-medium">{att.name}</span>
              {att.summary ? <span className="shrink-0 text-xs text-muted-foreground">({att.summary})</span> : null}
              <button
                type="button"
                aria-label={`移除 ${att.name}`}
                onClick={() => onRemoveAttachment?.(att.id)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <textarea
        ref={ref}
        rows={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onPaste={(e) => {
          const files = e.clipboardData?.files
          if (files && files.length > 0 && onAddFiles) {
            e.preventDefault()
            onAddFiles(files)
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            if (canSend) onSubmit()
          }
        }}
        placeholder={attachments.length ? '补充要求，或直接回车发送…' : '输入需求，或拖入户型图 / 清单…'}
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
              <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                <Upload className="size-4" />
                上传户型图 / 点位文件
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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

          <button
            type="button"
            aria-label="上传文件"
            title="上传户型图（PNG/JPG）、点位 JSON 或 CSV/TXT 清单（支持直接拖入）"
            onClick={() => fileInputRef.current?.click()}
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Paperclip className="size-3.5" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                {selectedModel.tierBadge ? (
                  <span
                    className={cn(
                      'rounded px-1 py-0.2 text-[10px] font-semibold',
                      selectedModel.tierBadge === 'Pro'
                        ? 'bg-amber-500/12 text-amber-800 dark:text-amber-400'
                        : selectedModel.tierBadge === 'Plus'
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {selectedModel.tierBadge}
                  </span>
                ) : null}
                {selectedModel.name}
                <ChevronDown className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-72">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">选择 AI 模型（Go / Plus / Pro 分档）</DropdownMenuLabel>
              {models.map((m) => (
                <DropdownMenuItem key={m.id} onSelect={() => onSelectModel(m.id)} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="truncate font-medium">{m.name}</span>
                      <span
                        className={cn(
                          'shrink-0 rounded px-1.5 py-0.2 text-[10px] font-semibold',
                          m.tierBadge === 'Pro'
                            ? 'bg-amber-500/12 text-amber-800 dark:text-amber-400'
                            : m.tierBadge === 'Plus'
                              ? 'bg-primary/15 text-primary'
                              : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {m.tierBadge ?? 'Go'}
                      </span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{m.tag} · 按量计费{m.cost !== 1 ? ` ×${m.cost}` : ''}</div>
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
            disabled={!canSend}
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
