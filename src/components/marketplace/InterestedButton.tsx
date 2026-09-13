'use client'

import { useState, useTransition } from 'react'
import { revealListingContactAction, type ContactRevealResult } from '@/lib/listing-contact'
import { Button } from '@/components/ui/Button'

export function InterestedButton({ listingId }: { listingId: string }) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<ContactRevealResult | null>(null)

  function handleClick() {
    startTransition(async () => {
      setResult(await revealListingContactAction(listingId))
    })
  }

  if (result?.email) {
    return (
      <p className="text-sm text-graphite">
        Contact {result.name}:{' '}
        <a href={`mailto:${result.email}`} className="font-medium text-signal hover:text-signal-hover">
          {result.email}
        </a>
      </p>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" size="sm" variant="secondary" onClick={handleClick} disabled={isPending}>
        {isPending ? 'Loading…' : "I'm interested"}
      </Button>
      {result?.error && <p className="text-micro text-bad">{result.error}</p>}
    </div>
  )
}
