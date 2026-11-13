'use client'

import { useState, useTransition } from 'react'
import { Loader2, Presentation } from 'lucide-react'

import { SelectableCard } from '@astryxdesign/core/SelectableCard'
import { useToast } from '@astryxdesign/core/Toast'
import {
  DISPLAY_PROFILES,
  resolveDisplayProfile,
  type DisplayProfileId,
} from '@/lib/display-profile'

import { setDisplayProfile } from './display-profile-action'

/**
 * 点位图的「显示方案」选择器。
 *
 * 与上面那组「显示设置」的区别，**必须让用户一眼看懂**：
 * - 显示设置（网格 / 标尺 / 覆盖圈…）= 只是**你自己屏幕上**的临时预览，按浏览器记住
 * - 显示方案（这里）= **随项目保存**，决定方案模板打印 / 导出时点位图长什么样
 *
 * 所以文案写「方案模板中」，而不是含糊的「显示效果」。
 */
export function DisplayProfilePicker({
  projectId,
  initial,
}: {
  projectId: string
  initial: unknown
}) {
  const showToast = useToast()
  const [current, setCurrent] = useState<DisplayProfileId>(resolveDisplayProfile(initial).id)
  const [pending, startSave] = useTransition()

  function pick(id: DisplayProfileId) {
    if (id === current || pending) return
    const prev = current
    setCurrent(id) // 乐观更新：切方案是轻操作，不该等网络
    startSave(async () => {
      const res = await setDisplayProfile(projectId, id)
      if (!res.ok) {
        setCurrent(prev)
        showToast({ body: res.error, type: 'error' })
        return
      }
      const p = resolveDisplayProfile(id)
      showToast({
        body: (
          <span>
            已切换为「{p.label}」
            <span className="mt-0.5 block text-xs opacity-80">
              方案模板与导出的 PDF 会按这个方案显示点位图
            </span>
          </span>
        ),
      })
    })
  }

  return (
    <div className="border-b px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <Presentation className="size-3.5 text-muted-foreground" />
          显示方案（方案模板中）
        </span>
        {pending ? <Loader2 className="size-3 animate-spin text-muted-foreground" /> : null}
      </div>

      <div role="group" aria-label="点位图显示方案" className="flex flex-col gap-1">
        {DISPLAY_PROFILES.map((p) => (
          <SelectableCard
            key={p.id}
            label={`${p.label}：${p.description}`}
            isSelected={p.id === current}
            onChange={() => pick(p.id)}
            padding={2}
            width="100%"
          >
            <span className="min-w-0">
              <span className="block text-xs font-medium">{p.label}</span>
              <span className="block text-[11px] leading-relaxed text-muted-foreground">
                {p.description}
              </span>
            </span>
          </SelectableCard>
        ))}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        只影响方案模板与导出 PDF 里的点位图；上面那组「显示设置」只改你自己屏幕上的预览。
      </p>
    </div>
  )
}
