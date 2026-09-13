import type { DataSource } from '@prisma/client'
import { Badge } from './Badge'

const LABELS: Record<DataSource, string> = {
  DEMO: 'Demo data',
  MANUFACTURER_VERIFIED: 'Manufacturer verified',
  ADMIN_VERIFIED: 'Admin verified',
  COMMUNITY_SUBMITTED: 'Community submitted',
  IMPORTED: 'Imported, unverified',
}

const VERIFIED_SOURCES: DataSource[] = ['MANUFACTURER_VERIFIED', 'ADMIN_VERIFIED']

// Amber (the `caution` tone) is reserved exclusively for provenance and
// not-connected warnings, so this can never read as decoration.
export function SourceBadge({ source }: { source: DataSource }) {
  const verified = VERIFIED_SOURCES.includes(source)
  return <Badge tone={verified ? 'good' : 'caution'}>{LABELS[source]}</Badge>
}
