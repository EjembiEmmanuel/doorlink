import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-md border border-line">
      <table className={cn('w-full border-collapse text-sm', className)} {...props} />
    </div>
  )
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'border-b border-line bg-rail px-4 py-2.5 text-left text-micro font-medium uppercase tracking-wide text-zinc-deep',
        className
      )}
      {...props}
    />
  )
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('border-b border-line px-4 py-2.5 text-graphite', className)} {...props} />
}

export interface SpecListItem {
  label: string
  value: string
  unit?: string
}

export function SpecList({ items }: { items: SpecListItem[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
          <dt className="text-sm text-zinc-deep">{item.label}</dt>
          <dd className="font-code text-sm text-graphite">
            {item.value}
            {item.unit ? ` ${item.unit}` : ''}
          </dd>
        </div>
      ))}
    </dl>
  )
}
