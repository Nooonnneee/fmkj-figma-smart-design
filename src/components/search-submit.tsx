'use client'

import { useFormStatus } from 'react-dom'

import { Button } from '@astryxdesign/core/Button'

/** next/form 搜索按钮：提交后到结果返回之前显示加载状态。 */
export function SearchSubmit({ variant = 'secondary' }: { variant?: 'secondary' | 'primary' }) {
  const { pending } = useFormStatus()
  return <Button type="submit" variant={variant} isLoading={pending} label="搜索" />
}
