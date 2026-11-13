'use client'

import { useState } from 'react'

import { TextInput } from '@astryxdesign/core/TextInput'

/**
 * 服务端搜索表单里的受控输入框。
 *
 * ## 为什么必须有这个客户端封装
 *
 * 官方 `TextInput` 是**客户端组件**、`value` 必填（受控）、没有 `defaultValue`。
 * 产品库（`products/page.tsx`）与项目列表（`projects/page.tsx`）是**服务端组件**
 * ——它们要 `await` 取数据，而且服务端组件不能把 `onChange` 这类函数跨 RSC 边界
 * 传给客户端组件（React 只允许传可序列化的 props）。
 *
 * 直接把官方 `TextInput` 放进服务端组件，只能传 `value` 不能传 `onChange`，
 * 结果是**只读字段**，搜索框根本没法输入。
 *
 * 所以这里划一个最小的客户端边界：值存在客户端 `useState` 里喂给官方 `TextInput`；
 * `htmlName` 让输入照旧作为一个普通表单字段随外层 `<Form action="/…">`（next/form 的
 * GET 提交）进入 FormData，服务端按 query 参数重新渲染 —— 这正是官方组件在 RSC 下的
 * **正常用法**，不是「兼容旧 API 的适配层」。
 *
 * ⚠️ 不要当冗余封装删掉：删了它，这两个搜索框要么变只读、要么得把整页改成客户端组件。
 * （`src/components/ui/input.tsx` 那个旧适配层仍在别的桶使用，与本文件无关。）
 */
export function SearchField({
  name,
  defaultValue = '',
  placeholder,
  ariaLabel,
  controlClassName,
}: {
  /** 表单字段名，随 Form 提交进 query */
  name: string
  /** 初始值：服务端从当前 query 传下来 */
  defaultValue?: string
  placeholder?: string
  /** 可访问名称（官方 label 必填，这里隐藏显示） */
  ariaLabel: string
  /** 官方输入框本体不接 className，一律走 controlClassName */
  controlClassName?: string
}) {
  const [value, setValue] = useState(defaultValue)
  return (
    <TextInput
      label={ariaLabel}
      isLabelHidden
      htmlName={name}
      value={value}
      onChange={(next) => setValue(next)}
      placeholder={placeholder}
      controlClassName={controlClassName}
    />
  )
}
