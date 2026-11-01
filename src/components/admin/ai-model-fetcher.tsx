'use client'

import { useEffect, useState } from 'react'

import { AI_PROVIDER_CHANNEL_LIST } from '@/plugins/ai-copilot/templates'

type Custom = { key: string; label?: string }

const API = '/api/globals/ai-settings'
const box: React.CSSProperties = { border: '1px solid var(--theme-elevation-150)', borderRadius: 6, padding: 16, margin: '8px 0 24px', background: 'var(--theme-elevation-50)' }
const btn: React.CSSProperties = { padding: '6px 14px', borderRadius: 4, border: '1px solid var(--theme-elevation-250)', background: 'var(--theme-elevation-0)', cursor: 'pointer', fontSize: 13 }

/** 后台「AI 设置」里的模型获取面板：选渠道 → 获取模型 → 勾选 → 加入模型列表 */
export function AiModelFetcher() {
  const [customs, setCustoms] = useState<Custom[]>([])
  const [channel, setChannel] = useState('deepseek')
  const [models, setModels] = useState<string[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [manual, setManual] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    fetch(`${API}?depth=0`, { credentials: 'include' })
      .then((r) => r.json())
      .then((g: { customChannels?: Custom[] }) => setCustoms((g.customChannels ?? []).filter((c) => c.key)))
      .catch(() => null)
  }, [])

  const body = () => (channel.startsWith('custom:') ? { channelId: 'custom', customChannel: channel.slice(7) } : { channelId: channel })

  const load = async () => {
    setBusy(true)
    setMsg(null)
    setModels([])
    setPicked(new Set())
    try {
      const r = await fetch(`${API}/models`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body()) })
      const d = (await r.json()) as { models?: string[]; error?: string }
      if (!r.ok || d.error) setMsg({ ok: false, text: d.error ?? '获取失败' })
      else {
        setModels(d.models ?? [])
        setMsg({ ok: true, text: `获取到 ${d.models?.length ?? 0} 个模型，勾选要启用的模型` })
      }
    } catch {
      setMsg({ ok: false, text: '网络错误' })
    }
    setBusy(false)
  }

  const add = async () => {
    const list = [...picked, ...manual.split(/[\s,，]+/).map((s) => s.trim()).filter(Boolean)]
    if (!list.length) return setMsg({ ok: false, text: '请勾选或手动填写模型名' })
    setBusy(true)
    try {
      const r = await fetch(`${API}/models/add`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body(), models: list }) })
      const d = (await r.json()) as { added?: number; skipped?: number; error?: string }
      if (!r.ok || d.error) {
        setMsg({ ok: false, text: d.error ?? '添加失败' })
        setBusy(false)
        return
      }
      setMsg({ ok: true, text: `已启用 ${d.added} 个模型${d.skipped ? `（${d.skipped} 个已存在，已跳过）` : ''}，正在刷新…` })
      setTimeout(() => window.location.reload(), 800)
    } catch {
      setMsg({ ok: false, text: '网络错误' })
      setBusy(false)
    }
  }

  const shown = models.filter((m) => m.toLowerCase().includes(filter.toLowerCase()))
  const toggle = (m: string) => setPicked((s) => {
    const n = new Set(s)
    if (n.has(m)) n.delete(m)
    else n.add(m)
    return n
  })

  return (
    <div style={box}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>获取模型并启用</div>
      <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)', marginBottom: 12 }}>
        选择渠道后点「获取模型」，勾选要启用的模型加入下方列表。自定义渠道需先填写并<strong>保存</strong>。如接口不支持获取列表，可直接手动填写模型名。
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={channel} onChange={(e) => setChannel(e.target.value)} style={{ ...btn, minWidth: 260 }}>
          {AI_PROVIDER_CHANNEL_LIST.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
          {customs.map((c) => (
            <option key={c.key} value={`custom:${c.key}`}>自定义 · {c.label || c.key}</option>
          ))}
        </select>
        <button type="button" style={btn} disabled={busy} onClick={load}>{busy ? '处理中…' : '获取模型'}</button>
      </div>
      {msg ? <div style={{ marginTop: 10, fontSize: 13, color: msg.ok ? 'var(--theme-success-600, #16a34a)' : 'var(--theme-error-600, #dc2626)' }}>{msg.text}</div> : null}
      {models.length ? (
        <>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
            <input placeholder="搜索模型" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ ...btn, flex: 1, cursor: 'text' }} />
            <button type="button" style={btn} onClick={() => setPicked(new Set([...picked, ...shown]))}>全选</button>
            <button type="button" style={btn} onClick={() => setPicked(new Set())}>清空</button>
          </div>
          <div style={{ marginTop: 8, maxHeight: 260, overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 4, border: '1px solid var(--theme-elevation-100)', borderRadius: 4, padding: 8, background: 'var(--theme-elevation-0)' }}>
            {shown.map((m) => (
              <label key={m} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, cursor: 'pointer', padding: '2px 4px' }}>
                <input type="checkbox" checked={picked.has(m)} onChange={() => toggle(m)} />
                <span style={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m}</span>
              </label>
            ))}
          </div>
        </>
      ) : null}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
        <input placeholder="手动填写模型名，多个用逗号或空格分隔" value={manual} onChange={(e) => setManual(e.target.value)} style={{ ...btn, flex: 1, cursor: 'text' }} />
        <button type="button" style={{ ...btn, background: 'var(--theme-elevation-800)', color: 'var(--theme-elevation-0)' }} disabled={busy} onClick={add}>
          启用所选{picked.size ? `（${picked.size}）` : ''}
        </button>
      </div>
    </div>
  )
}
