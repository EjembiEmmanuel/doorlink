import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { can } from '@/lib/rbac'

export default async function SupplierLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/sign-in')
  if (!can(session.role, 'listing:write:own') || !session.organizationId) redirect('/')

  return (
    <div className="mx-auto max-w-shell px-4 py-10">
      <div className="mb-8 flex flex-col gap-1 border-b border-line pb-6">
        <p className="text-micro font-medium uppercase tracking-wide text-zinc-deep">Supplier</p>
        <h1 className="text-2xl font-semibold text-graphite">Your listings</h1>
      </div>
      {children}
    </div>
  )
}
