import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type BadgeTone = 'neutral' | 'signal' | 'caution' | 'good' | 'bad'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-rail text-graphite-soft',
  signal: 'bg-signal-tint text-signal',
  caution: 'bg-caution-tint text-caution',
  good: 'bg-good/10 text-good',
  bad: 'bg-bad/10 text-bad',
}

export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-micro font-medium uppercase tracking-wide',
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    />
  )
}
