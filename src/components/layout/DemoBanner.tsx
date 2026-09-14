import { isDemoMode } from '@/lib/integrations'

// This used to say the whole catalogue was invented sample data. That
// stopped being true the moment real manufacturer documents (FAAC, BFT)
// were ingested alongside the seeded demo models — a blanket "none of
// this is real" is just as dishonest as a blanket "all of this is
// verified". The per-record <SourceBadge /> does the precise work; this
// banner only points at it.
export function DemoBanner() {
  if (!isDemoMode) return null

  return (
    <div className="bg-caution-tint px-4 py-2 text-center text-sm text-caution">
      Demo mode — this build mixes real manufacturer documents with invented sample data. Every record
      is labelled with where it came from.
    </div>
  )
}
