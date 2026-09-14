import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-md border border-line bg-paper shadow-panel', className)} {...props} />
}

export function PanelHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-b border-line px-5 py-4', className)} {...props} />
}

export function PanelBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />
}
