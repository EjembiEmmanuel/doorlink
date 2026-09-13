'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { respondToLeadAction, type LeadContactResult } from './actions'
import { Button } from '@/components/ui/Button'

export function RespondButton({ leadId }: { leadId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<LeadContactResult | null>(null)

  function handleClick() {
    startTransition(async () => {
      const outcome = await respondToLeadAction(leadId)
      setResult(outcome)
      if (outcome.email) router.refresh()
    })
  }

  if (result?.email) {
    return (
      <p className="text-sm text-graphite">
        Contact {result.name}:{' '}
        <a href={`mailto:${result.email}`} className="font-medium text-signal hover:text-signal-hover">
          {result.email}
        </a>
        {result.phone && <span> · {result.phone}</span>}
      </p>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" size="sm" onClick={handleClick} disabled={isPending}>
        {isPending ? 'Claiming…' : 'Respond'}
      </Button>
      {result?.error && <p className="text-micro text-bad">{result.error}</p>}
    </div>
  )
}
