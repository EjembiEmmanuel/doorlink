import type { Metadata } from 'next'
import type { DataSource } from '@prisma/client'
import { SourceBadge } from '@/components/ui/SourceBadge'

export const metadata: Metadata = {
  title: 'Data sources',
  description: "How DoorLink labels where every catalogue record comes from, and what each label means.",
  alternates: { canonical: '/data-sources' },
}

const SOURCES: { source: DataSource; description: string }[] = [
  {
    source: 'MANUFACTURER_VERIFIED',
    description: 'Supplied directly by the manufacturer and confirmed against their own documentation.',
  },
  {
    source: 'ADMIN_VERIFIED',
    description: 'Checked and confirmed by DoorLink staff against a primary source.',
  },
  {
    source: 'COMMUNITY_SUBMITTED',
    description: 'Submitted by a technician or supplier and not yet independently confirmed.',
  },
  {
    source: 'IMPORTED',
    description: 'Loaded from a bulk import and not yet reviewed.',
  },
  {
    source: 'DEMO',
    description: 'Invented sample data used to demonstrate the platform. No real brand, model or manual appears here.',
  },
]

export default function DataSourcesPage() {
  return (
    <div className="mx-auto max-w-prose px-4 py-12">
      <h1 className="text-2xl font-semibold text-graphite">Where this data comes from</h1>
      <p className="mt-3 text-graphite-soft">
        Every catalogue record on DoorLink carries a label saying where it came from. Nothing is
        presented as verified unless it actually is.
      </p>

      <ul className="mt-8 flex flex-col gap-6">
        {SOURCES.map((item) => (
          <li key={item.source} className="flex flex-col gap-2 border-b border-line pb-6">
            <SourceBadge source={item.source} />
            <p className="text-sm text-graphite-soft">{item.description}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
