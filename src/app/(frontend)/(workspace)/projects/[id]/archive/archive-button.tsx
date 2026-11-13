'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, ArchiveRestore } from 'lucide-react'

import { Button } from '@astryxdesign/core/Button'
import { useToast } from '@astryxdesign/core/Toast'

import { setProjectArchived } from './actions'

export function ArchiveButton({
  projectId,
  archived,
  primary,
}: {
  projectId: string
  archived: boolean
  primary: boolean
}) {
  const router = useRouter()
  const showToast = useToast()
  const [pending, startTransition] = useTransition()
  return (
    <Button
      variant={archived || !primary ? 'secondary' : 'primary'}
      isDisabled={pending}
      isLoading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await setProjectArchived(projectId, !archived)
          if (!result.ok) return void showToast({ body: result.error, type: 'error' })
          showToast({ body: archived ? '项目已恢复为进行中' : '项目已归档' })
          router.refresh()
        })
      }
      icon={archived ? <ArchiveRestore /> : <Archive />}
      label={archived ? '恢复项目' : '归档项目'}
    />
  )
}
