import type { ReactNode } from 'react'

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-line px-6 py-12 text-center">
      <p className="font-medium text-graphite">{title}</p>
      {description && <p className="max-w-prose text-sm text-zinc-deep">{description}</p>}
      {action}
    </div>
  )
}
