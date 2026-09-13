import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'

export default async function SupportLayout({ children }: { children: ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  return (
    <div className="mx-auto max-w-shell px-4 py-10">
      <div className="mb-8 flex flex-col gap-1 border-b border-line pb-6">
        <p className="text-micro font-medium uppercase tracking-wide text-zinc-deep">Support</p>
        <h1 className="text-2xl font-semibold text-graphite">Help</h1>
      </div>
      {children}
    </div>
  )
}
