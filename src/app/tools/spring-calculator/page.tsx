import type { Metadata } from 'next'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { ASSET_TYPE_LABELS } from '@/lib/labels'
import { SpringCalculator } from './SpringCalculator'

export const metadata: Metadata = {
  title: 'Garage door spring calculator',
  description:
    'Estimate torsion and extension spring requirements for a garage door. Metric-first, built for technicians.',
  alternates: { canonical: '/tools/spring-calculator' },
}

export default async function SpringCalculatorPage() {
  const session = await getSession()

  // The calculator itself is public and works signed out — saving is
  // the only part that needs an account. A failed asset lookup must
  // therefore never stop the page rendering.
  let assets: Array<{ id: string; label: string }> = []
  if (session) {
    try {
      const rows = await prisma.asset.findMany({
        where: { organization: { members: { some: { userId: session.userId } } } },
        orderBy: { name: 'asc' },
        take: 200,
        select: {
          id: true,
          name: true,
          reference: true,
          assetType: true,
          site: { select: { name: true } },
        },
      })
      assets = rows.map((asset) => ({
        id: asset.id,
        label: `${asset.name} — ${ASSET_TYPE_LABELS[asset.assetType]}${
          asset.site?.name ? ` · ${asset.site.name}` : ''
        }`,
      }))
    } catch (error) {
      if (!isDatabaseUnreachable(error)) throw error
      assets = []
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-6">
        <Link href="/tools" className="text-sm text-graphite-soft underline">
          Tools
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-graphite">Spring calculator</h1>
        <p className="mt-2 max-w-prose text-sm text-graphite-soft">
          Estimate what a garage door needs from its springs. Answer a few questions rather than
          filling in a form — you only see the measurements your chosen method actually needs.
        </p>
      </header>

      <SpringCalculator assets={assets} canSave={!!session} />
    </div>
  )
}
