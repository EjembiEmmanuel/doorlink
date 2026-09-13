import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { can } from '@/lib/rbac'

const ADMIN_NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/manufacturers', label: 'Manufacturers' },
  { href: '/admin/categories', label: 'Categories' },
  { href: '/admin/models', label: 'Models' },
  { href: '/admin/compatibility', label: 'Compatibility' },
]

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/sign-in')
  if (!can(session.role, 'catalogue:write')) redirect('/')

  return (
    <div className="mx-auto max-w-shell px-4 py-10">
      <div className="mb-8 flex flex-col gap-1 border-b border-line pb-6">
        <p className="text-micro font-medium uppercase tracking-wide text-zinc-deep">Admin</p>
        <h1 className="text-2xl font-semibold text-graphite">Catalogue management</h1>
      </div>
      <div className="flex flex-col gap-8 lg:flex-row">
        <nav className="flex shrink-0 flex-row gap-2 lg:w-48 lg:flex-col">
          {ADMIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded px-3 py-2 text-sm font-medium text-graphite hover:bg-rail"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}
