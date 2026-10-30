'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AlertCircle, ChevronDown, Loader2, Maximize2, MoreHorizontal, SquarePen, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { AiMessageBubble, AiPromptComposer, type AiChatMessage, type AiConnectablePlugin, type AiProjectContext, type AiToolCall } from '@/components/ai/ai-elements'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { AI_MODELS, DEFAULT_AI_TEMPLATES, fillPromptTemplate } from '@/plugins/ai-copilot/templates'

type ConvSummary = { id: string; title: string }
type StoredMessage = { id: string; role: 'user' | 'assistant'; content: string; model: string | null; cost: number | null; toolCalls: AiToolCall[] | null; createdAt: string }

const toChat = (m: StoredMessage): AiChatMessage => ({
  id: m.id,
  role: m.role,
  content: m.content,
  createdAt: m.createdAt,
  modelName: AI_MODELS.find((x) => x.id === m.model)?.name,
  cost: m.cost ?? undefined,
  toolCalls: m.toolCalls ?? undefined,
})

/** 侧边栏 AI 对话：真实调用服务端 /ai/chat（流式），会话和积分存在 Payload。 */
export function AiSidebarDock({
  plugins,
  projects,
  credits: initialCredits,
  configured,
}: {
  plugins: AiConnectablePlugin[]
  projects: AiProjectContext[]
  credits: number
  configured: boolean
}) {
  const pathname = usePathname()
  const routeProjectId = useMemo(() => {
    const id = pathname.match(/^\/projects\/([^/]+)/)?.[1]
    return id && projects.some((p) => p.id === id) ? id : null
  }, [pathname, projects])

  const [modelId, setModelId] = useState(AI_MODELS[0].id)
  const [connected, setConnected] = useState<string[]>(() => plugins.filter((p) => p.status === 'ready' && p.enabled).map((p) => p.id))
  const [projectId, setProjectId] = useState<string | null>(routeProjectId)
  const [credits, setCredits] = useState(initialCredits)
  const [conversations, setConversations] = useState<ConvSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AiChatMessage[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [input, setInput] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => setCredits(initialCredits), [initialCredits])
  useEffect(() => {
    if (routeProjectId) setProjectId(routeProjectId)
  }, [routeProjectId])

  const model = AI_MODELS.find((m) => m.id === modelId) ?? AI_MODELS[0]
  const project = projects.find((p) => p.id === projectId) ?? null
  const activeTitle = conversations.find((c) => c.id === activeId)?.title ?? '新对话'

  const loadConversations = useCallback(async () => {
    const res = await fetch('/ai/conversations').catch(() => null)
    const data = (await res?.json().catch(() => null)) as { conversations?: ConvSummary[] } | null
    if (data?.conversations) setConversations(data.conversations)
  }, [])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [messages])

  async function openConversation(id: string) {
    if (streaming) return
    setActiveId(id)
    setLoadingHistory(true)
    setMessages([])
    try {
      const res = await fetch(`/ai/conversations/${id}`)
      const data = (await res.json()) as { ok?: boolean; messages?: StoredMessage[]; error?: string }
      if (!res.ok || !data.messages) throw new Error(data.error)
      setMessages(data.messages.map(toChat))
    } catch {
      toast.error('读取会话失败')
    } finally {
      setLoadingHistory(false)
    }
  }

  async function deleteConversation(id: string) {
    const res = await fetch(`/ai/conversations/${id}`, { method: 'DELETE' }).catch(() => null)
    if (!res?.ok) return toast.error('删除失败')
    setConversations((prev) => prev.filter((c) => c.id !== id))
    if (id === activeId) startNew()
  }

  function startNew() {
    if (streaming) return
    setActiveId(null)
    setMessages([])
  }

  function pickTemplate(id: string) {
    const tpl = DEFAULT_AI_TEMPLATES.find((t) => t.id === id)
    if (!tpl) return
    setModelId(tpl.recommendedModelId)
    setConnected((prev) => Array.from(new Set([...prev, ...tpl.requiredPlugins])))
    setInput(fillPromptTemplate(tpl, {}))
  }

  async function send(raw: string) {
    const text = raw.trim()
    if (!text || streaming) return
    if (!configured) return toast.error('还没有配置 AI 密钥')
    if (credits < model.cost) return toast.error(`积分不足（剩余 ${credits}，需要 ${model.cost}），请联系管理员发放`)

    const now = new Date().toISOString()
    const replyId = `pending-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', content: text, createdAt: now },
      { id: replyId, role: 'assistant', content: '', createdAt: now, modelName: model.name, toolCalls: [] },
    ])
    setInput('')
    setStreaming(true)
    setThinking(true)
    const patchReply = (fn: (m: AiChatMessage) => AiChatMessage) => setMessages((prev) => prev.map((m) => (m.id === replyId ? fn(m) : m)))
    const dropReply = () => setMessages((prev) => prev.filter((m) => m.id !== replyId || m.content))

    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await fetch('/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: activeId, message: text, modelId: model.id, projectId, pluginIds: connected }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? '发送失败，请稍后重试')
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          const ev = JSON.parse(line) as { type: string; [k: string]: unknown }
          if (ev.type === 'meta' && typeof ev.conversationId === 'string') {
            const cid = ev.conversationId
            if (!activeId) {
              setActiveId(cid)
              setConversations((prev) => [{ id: cid, title: text.slice(0, 30) }, ...prev.filter((c) => c.id !== cid)])
            }
          } else if (ev.type === 'tool') {
            patchReply((m) => ({ ...m, toolCalls: [...(m.toolCalls ?? []), { pluginId: String(ev.pluginId), pluginName: String(ev.pluginName), action: '', summary: String(ev.summary ?? ''), details: [], href: ev.href as string | undefined }] }))
          } else if (ev.type === 'delta') {
            setThinking(false)
            patchReply((m) => ({ ...m, content: m.content + String(ev.text) }))
          } else if (ev.type === 'done') {
            patchReply((m) => ({ ...m, id: String(ev.messageId), cost: Number(ev.cost) }))
            if (typeof ev.balance === 'number') setCredits(ev.balance)
          } else if (ev.type === 'error') {
            throw new Error(String(ev.error))
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') dropReply()
      else patchReply((m) => (m.content ? m : { ...m, content: `发送失败：${(error as Error).message || '请稍后重试'}`, error: true }))
    } finally {
      setStreaming(false)
      setThinking(false)
      abortRef.current = null
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 items-center justify-between gap-1 px-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="inline-flex max-w-52 items-center gap-1 rounded-md px-2 py-1 text-sm font-medium hover:bg-sidebar-accent">
              <span className="truncate">{activeTitle}</span>
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">最近对话</DropdownMenuLabel>
            {conversations.length === 0 ? <div className="px-2 py-1.5 text-xs text-muted-foreground">还没有对话</div> : null}
            {conversations.map((c) => (
              <DropdownMenuItem key={c.id} onSelect={() => void openConversation(c.id)} className="group flex items-center justify-between">
                <span className={cn('truncate', c.id === activeId && 'font-medium')}>{c.title}</span>
                <button
                  type="button"
                  aria-label="删除"
                  onClick={(e) => {
                    e.stopPropagation()
                    void deleteConversation(c.id)
                  }}
                  className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex items-center">
          <button type="button" aria-label="新对话" onClick={startNew} className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
            <SquarePen className="size-4" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="更多" className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground tabular-nums">剩余 {credits} 积分</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/ai">
                  <Maximize2 className="size-4" />
                  全屏打开
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div ref={scroller} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-2">
        {!configured ? (
          <div className="flex items-start gap-2 rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            <span>还没有配置 AI 密钥。请在 Make 设置 → Secrets 里添加 DEEPSEEK_API_KEY，保存后刷新页面。</span>
          </div>
        ) : null}
        {loadingHistory ? (
          <Loader2 className="m-auto size-4 animate-spin text-muted-foreground" />
        ) : messages.length === 0 ? (
          <div className="m-auto w-full space-y-4 text-center">
            <p className="text-base font-medium">{project ? `关于「${project.name}」，想做点什么？` : '有什么可以帮你？'}</p>
            <div className="flex flex-col gap-1.5">
              {DEFAULT_AI_TEMPLATES.slice(0, 3).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pickTemplate(t.id)}
                  className="rounded-xl border px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) =>
            m.role === 'assistant' && !m.content && thinking ? (
              <div key={m.id} className="flex flex-col gap-1.5">
                {m.toolCalls?.map((c, i) => (
                  <span key={i} className="text-xs text-muted-foreground">已使用 {c.pluginName}</span>
                ))}
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  {model.reasoning ? '思考中…' : '正在回复…'}
                </span>
              </div>
            ) : (
              <AiMessageBubble key={m.id} message={m} />
            ),
          )
        )}
      </div>

      <div className="p-2.5 pt-1">
        <AiPromptComposer
          value={input}
          onChange={setInput}
          onSubmit={() => void send(input)}
          streaming={streaming}
          onStop={() => abortRef.current?.abort()}
          models={AI_MODELS}
          selectedModel={model}
          onSelectModel={setModelId}
          plugins={plugins}
          connectedPluginIds={connected}
          onTogglePlugin={(id) => setConnected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}
          projects={projects}
          selectedProjectId={projectId}
          onSelectProject={setProjectId}
          templates={DEFAULT_AI_TEMPLATES.map((t) => ({ id: t.id, name: t.name }))}
          onPickTemplate={pickTemplate}
        />
        <p className="mt-1.5 text-center text-[11px] text-muted-foreground">AI 生成内容仅供参考，请核对后使用</p>
      </div>
    </div>
  )
}
