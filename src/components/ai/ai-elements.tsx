'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowUp,
  Blocks,
  Check,
  ChevronDown,
  Copy,
  FileCode2,
  FileText,
  FolderKanban,
  ImageIcon,
  Loader2,
  Paperclip,
  Plus,
  RotateCcw,
  Square,
  Upload,
  X,
} from 'lucide-react'

import { Button } from '@astryxdesign/core/Button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuDivider,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSubMenu,
} from '@astryxdesign/core/DropdownMenu'
import { IconButton } from '@astryxdesign/core/IconButton'
import { cn } from '@/lib/utils'

import { MarkdownText } from './markdown'

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
export type AiConnectablePlugin = {
  id: string
  name: string
  description: string
  status: 'ready' | 'coming-soon'
  enabled: boolean
  where: string
  provides: string[]
}
export type AiProjectContext = {
  id: string
  name: string
  customerName: string | null
  platform: string | null
  pointCount: number
}
export type AiToolCall = {
  pluginId: string
  pluginName: string
  action: string
  summary: string
  details: string[]
  href?: string
  hrefLabel?: string
  imageUrl?: string
}
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
  /** 视觉模型判断的图片类型：floor-plan / quote-document / photo / rendering / other */
  imageKind?: string
  /** 户型图视觉复核进度：pending / done / failed / unavailable / skipped */
  visionStatus?: string
  detectedSwitchCount?: number
  detectedLightCount?: number
  /** 文本或 JSON 文件解析后的内容 */
  textContent?: string
  summary?: string
  error?: string
}
export type AiChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** 用户消息实际发给服务端的完整内容（含附件块），用于「重新生成」 */
  rawContent?: string
  createdAt: string
  modelName?: string
  cost?: number
  reasoning?: string
  toolCalls?: AiToolCall[]
  attachments?: Pick<AiAttachment, 'id' | 'name' | 'kind' | 'url' | 'summary'>[]
  error?: boolean
}

/** 从历史消息文本中分离出用户可见正文与附带的附件摘要（兼容刷新后从数据库读取的历史消息） */
function parseStoredUserContent(raw: string): {
  text: string
  fileBadges: { name: string; kind: string; url?: string }[]
} {
  // 服务端会把视觉识图结论追加在用户消息末尾（供后续对话参考），界面上不显示
  const briefIdx = raw.indexOf('\n\n【视觉识图结论】')
  if (briefIdx !== -1) raw = raw.slice(0, briefIdx)
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

type Suggestion = { label: string; prompt: string }

/** 根据这条回复执行过的工具，给出可一键发送的下一步（只在最后一条回复下显示） */
export function followUpSuggestions(message: AiChatMessage): Suggestion[] {
  const calls = message.toolCalls ?? []
  if (!calls.length || message.error) return []
  const href = (re: RegExp) => calls.some((c) => re.test(c.href ?? ''))
  if (href(/\/point-map/)) {
    return [
      {
        label: '仅导入开关',
        prompt:
          '请对当前项目的户型图重新生成点位，仅导入开关面板（importMode=switches, replaceExisting=true）',
      },
      {
        label: '导入全部（含灯具）',
        prompt:
          '请对当前项目的户型图重新生成点位，导入全部开关与灯具点位（importMode=all, replaceExisting=true）',
      },
      {
        label: '视觉智能布点',
        prompt:
          '请用视觉智能布点，按设计规范为当前户型规划 AP、窗帘、传感器、网关、中控屏等智能设备点位',
      },
      { label: '智能选型并出报价', prompt: '请按标准档为当前项目一键智能选型，并直接生成报价单' },
    ]
  }
  if (href(/\/quotes/)) {
    return [
      { label: '生成施工合同', prompt: '请根据当前报价单生成施工合同（默认三期付款）' },
      {
        label: '检查点位完整度',
        prompt: '请检查当前项目每个房间的点位配置是否完整，列出缺失项和优化建议',
      },
      { label: '导出报价单', prompt: '请给我当前项目报价单与方案的打印/导出链接' },
    ]
  }
  if (href(/\/contract/)) {
    return [
      { label: '导出合同', prompt: '请给我当前项目合同的打印/导出链接' },
      { label: '生成方案演示', prompt: '请为当前项目推荐合适的方案模板并给出方案演示链接' },
    ]
  }
  if (calls.some((c) => c.imageUrl)) {
    return [
      { label: '换个风格再来一张', prompt: '保持空间和构图，换一种设计风格再生成一张效果图' },
      { label: '改成夜间灯光氛围', prompt: '保持空间和构图，改成夜间灯光氛围再生成一张' },
      { label: '生成横版效果图', prompt: '把刚才的画面生成一张 1536*1024 的横版效果图' },
    ]
  }
  if (calls.some((c) => c.pluginId === 'vision')) {
    const detail = calls.find((c) => c.pluginId === 'vision')?.details?.[0] ?? ''
    if (/报价|单价|清单/.test(detail)) {
      return [
        {
          label: '生成对比报价单',
          prompt: '请按看图转写的外店报价明细，在当前项目生成对比报价单并分析差价',
        },
      ]
    }
    if (/户型|开关|房间|点位|图例/.test(detail)) {
      return [
        {
          label: '添加到项目点位图',
          prompt: '请把这张户型图添加到当前项目的点位图，并导入识别出的开关面板',
        },
        {
          label: '视觉智能布点',
          prompt: '请用视觉智能布点，按设计规范为这张户型规划 AP、窗帘、传感器等智能设备点位',
        },
      ]
    }
    return [
      {
        label: '据此生成效果图',
        prompt: '请参考这张图片生成一张全屋智能场景效果图（useAttachedImage=true）',
      },
    ]
  }
  return []
}

/** 一条消息：用户消息右侧浅灰气泡，AI 回复为无边框正文（参考 ChatGPT / Claude），支持底部快捷跟进胶囊。 */
export function AiMessageBubble({
  message,
  onRegenerate,
  onQuickAction,
  isLast = false,
}: {
  message: AiChatMessage
  onRegenerate?: () => void
  onQuickAction?: (prompt: string) => void
  /** 是否为最后一条回复（只在最后一条下面显示下一步建议） */
  isLast?: boolean
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
            <div className="rounded-2xl bg-muted px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap">
              {parsed.text}
            </div>
          ) : null}
        </div>
      </div>
    )
  }
  return (
    <div className="group flex flex-col gap-1.5">
      {message.reasoning ? (
        <details className="rounded-lg border bg-muted/30 px-2.5 py-1.5" open={!message.content}>
          <summary className="cursor-pointer text-xs text-muted-foreground select-none hover:text-foreground">
            {message.content ? '深度思考过程' : '深度思考中…'}
          </summary>
          <div className="mt-1.5 max-h-60 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {message.reasoning}
          </div>
        </details>
      ) : null}
      {message.toolCalls?.map((c, i) => (
        <div key={i} className="flex flex-col gap-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Blocks className="size-3" />
            <span>{c.summary ? `${c.pluginName}：${c.summary}` : `已使用 ${c.pluginName}`}</span>
            {c.href ? (
              <Link
                href={c.href}
                className="underline-offset-4 hover:text-foreground hover:underline"
              >
                {c.hrefLabel ?? '查看'}
              </Link>
            ) : null}
          </div>
          {c.details?.[0] ? (
            <details className="rounded-lg border bg-muted/30 px-2.5 py-1.5">
              <summary className="cursor-pointer text-xs text-muted-foreground select-none hover:text-foreground">
                查看视觉识图结论
              </summary>
              <MarkdownText text={c.details[0]} className="mt-1.5 text-xs text-foreground/90" />
            </details>
          ) : null}
          {c.imageUrl ? (
            <a href={c.imageUrl} target="_blank" rel="noreferrer" className="block w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.imageUrl}
                alt="AI 生成图片"
                className="max-h-64 max-w-full rounded-xl border object-contain"
              />
            </a>
          ) : null}
        </div>
      ))}
      {message.error ? (
        <div className="rounded-xl border border-dashed px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {message.content}
        </div>
      ) : message.content ? (
        <MarkdownText text={message.content} />
      ) : null}
      {onQuickAction && isLast && followUpSuggestions(message).length ? (
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {followUpSuggestions(message).map((s) => (
            <Button
              key={s.label}
              type="button"
              variant="secondary"
              size="sm"
              label={s.label}
              className="rounded-full text-xs font-normal text-muted-foreground hover:text-foreground"
              onClick={() => onQuickAction(s.prompt)}
            />
          ))}
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
          <IconButton
            type="button"
            variant="ghost"
            size="sm"
            label="复制"
            onClick={() => {
              void navigator.clipboard?.writeText(message.content)
              setCopied(true)
              setTimeout(() => setCopied(false), 1200)
            }}
            icon={copied ? <Check /> : <Copy />}
          />
          {onRegenerate ? (
            <IconButton
              type="button"
              variant="ghost"
              size="sm"
              label="重新生成"
              onClick={onRegenerate}
              icon={<RotateCcw />}
            />
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
  const router = useRouter()
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
              <button
                type="button"
                aria-label="取消关联项目"
                onClick={() => onSelectProject(null)}
                className="hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ) : null}
          {attachments.map((att) => (
            <span
              key={att.id}
              className={cn(
                'inline-flex max-w-full items-center gap-1.5 rounded-lg border bg-muted/50 px-2 py-1 text-xs',
                att.status === 'error' &&
                  'border-destructive/40 bg-destructive/10 text-destructive',
              )}
            >
              {att.status === 'uploading' ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
              ) : att.kind === 'image' && att.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={att.url}
                  alt={att.name}
                  className="size-5 shrink-0 rounded object-cover"
                />
              ) : att.kind === 'image' ? (
                <ImageIcon className="size-3.5 shrink-0 text-primary" />
              ) : att.kind === 'json' ? (
                <FileCode2 className="size-3.5 shrink-0 text-primary" />
              ) : (
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="max-w-36 truncate font-medium">{att.name}</span>
              {att.summary ? (
                <span className="shrink-0 text-xs text-muted-foreground">({att.summary})</span>
              ) : null}
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
          if (
            e.key === 'Enter' &&
            !e.shiftKey &&
            !e.nativeEvent.isComposing &&
            e.nativeEvent.keyCode !== 229
          ) {
            e.preventDefault()
            if (canSend) onSubmit()
          }
        }}
        placeholder={
          attachments.length ? '补充要求，或直接回车发送…' : '输入需求，或拖入户型图 / 清单…'
        }
        className="block max-h-[200px] w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-sm outline-none placeholder:text-muted-foreground"
      />
      <div className="flex items-center justify-between gap-2 px-2 pb-2">
        <div className="flex items-center gap-0.5">
          <DropdownMenu
            placement="above"
            menuWidth="14rem"
            renderTrigger={(props) => (
              <IconButton
                {...props}
                type="button"
                variant="ghost"
                size="sm"
                label="更多"
                icon={<Plus />}
              />
            )}
          >
            <DropdownMenuItem
              label="上传户型图 / 点位文件"
              icon={<Upload className="size-4" />}
              onClick={() => fileInputRef.current?.click()}
            />
            <DropdownMenuDivider />
            {templates?.length && onPickTemplate ? (
              <DropdownMenuSubMenu label="常用模板" menuWidth="14rem">
                {templates.map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    label={t.name}
                    onClick={() => onPickTemplate(t.id)}
                  />
                ))}
              </DropdownMenuSubMenu>
            ) : null}
            <DropdownMenuSubMenu label="关联项目" menuWidth="14rem">
              <DropdownMenuItem label="不关联" onClick={() => onSelectProject(null)} />
              {projects.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  label={<span className="truncate">{p.name}</span>}
                  onClick={() => onSelectProject(p.id)}
                />
              ))}
            </DropdownMenuSubMenu>
            <DropdownMenuSubMenu label="插件" menuWidth="14rem">
              {usable.map((p) => (
                <DropdownMenuCheckboxItem
                  key={p.id}
                  label={p.name}
                  value={connectedPluginIds.includes(p.id)}
                  onChange={() => onTogglePlugin(p.id)}
                />
              ))}
              <DropdownMenuDivider />
              {/* 本仓没有挂 LinkProvider，href 会整页跳转；
                  这里用 preventDefault + router.push 保持原来的客户端导航，
                  修饰键点击仍交给浏览器（官方在 href 行上会跳过 onClick）。 */}
              <DropdownMenuItem
                label="管理插件"
                href="/capabilities"
                onClick={(e) => {
                  e.preventDefault()
                  router.push('/capabilities')
                }}
              />
            </DropdownMenuSubMenu>
          </DropdownMenu>

          <IconButton
            type="button"
            variant="ghost"
            size="sm"
            label="上传文件"
            tooltip="上传户型图（PNG/JPG）、点位 JSON 或 CSV/TXT 清单（支持直接拖入）"
            onClick={() => fileInputRef.current?.click()}
            icon={<Paperclip />}
          />

          <DropdownMenu
            placement="above"
            menuWidth="18rem"
            renderTrigger={(props) => (
              <Button
                {...props}
                type="button"
                variant="ghost"
                size="sm"
                label={`选择 AI 模型：${selectedModel.name}`}
                className="text-xs text-muted-foreground"
              >
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
              </Button>
            )}
          >
            <DropdownMenuGroup title="选择 AI 模型（Go / Plus / Pro 分档）">
              {models.map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  label={
                    <span className="flex items-center gap-1.5">
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
                    </span>
                  }
                  description={`${m.tag} · 按量计费${m.cost !== 1 ? ` ×${m.cost}` : ''}`}
                  endContent={
                    m.id === selectedModel.id ? <Check className="size-3.5 shrink-0" /> : null
                  }
                  onClick={() => onSelectModel(m.id)}
                />
              ))}
            </DropdownMenuGroup>
          </DropdownMenu>
        </div>

        {streaming ? (
          <IconButton
            type="button"
            variant="primary"
            size="sm"
            label="停止"
            onClick={onStop}
            icon={<Square className="size-3 fill-current" />}
          />
        ) : (
          <IconButton
            type="button"
            variant="primary"
            size="sm"
            label="发送"
            isDisabled={!canSend}
            onClick={onSubmit}
            icon={<ArrowUp />}
          />
        )}
      </div>
    </div>
  )
}
