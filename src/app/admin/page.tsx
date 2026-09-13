import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { Panel, PanelBody } from '@/components/ui/Panel'
import { NotConnected } from '@/components/ui/NotConnected'

export default async function AdminOverviewPage() {
  let counts: [number, number, number, number, number]
  try {
    counts = await Promise.all([
      prisma.manufacturer.count(),
      prisma.category.count(),
      prisma.model.count(),
      prisma.document.count(),
      prisma.compatibility.count(),
    ])
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return <NotConnected feature="The catalogue database" reason="Can't load admin stats right now." />
  }

  const [manufacturers, categories, models, documents, compatibility] = counts

  const stats = [
    { label: 'Manufacturers', count: manufacturers, href: '/admin/manufacturers' },
    { label: 'Categories', count: categories, href: '/admin/categories' },
    { label: 'Models', count: models, href: '/admin/models' },
    { label: 'Documents', count: documents, href: null },
    { label: 'Compatibility links', count: compatibility, href: null },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {stats.map((stat) => (
        <Panel key={stat.label}>
          <PanelBody>
            <p className="text-micro font-medium uppercase tracking-wide text-zinc-deep">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold text-graphite">{stat.count}</p>
            {stat.href ? (
              <Link
                href={stat.href}
                className="mt-2 inline-block text-sm font-medium text-signal hover:text-signal-hover"
              >
                Manage →
              </Link>
            ) : (
              <p className="mt-2 text-sm text-zinc-deep">Admin screen not built yet.</p>
            )}
          </PanelBody>
        </Panel>
      ))}
    </div>
  )
}
