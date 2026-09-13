import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { devSignOutAction } from '@/lib/dev-session'
import { MobileNavToggle } from './MobileNavToggle'

const NAV_LINKS = [
  { href: '/find', label: 'Find your part' },
  { href: '/data-sources', label: 'Data sources' },
]

export async function Header() {
  const session = await getSession()
  const navLinks =
    session && can(session.role, 'catalogue:write') ? [...NAV_LINKS, { href: '/admin', label: 'Admin' }] : NAV_LINKS

  return (
    <header className="relative border-b border-line bg-paper">
      <div className="mx-auto flex h-16 max-w-shell items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-graphite">
          DoorLink
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm font-medium text-graphite hover:text-signal">
              {link.label}
            </Link>
          ))}
          {session ? (
            <div className="flex items-center gap-3 border-l border-line pl-6">
              <span className="text-sm text-zinc-deep">{session.name}</span>
              <form action={devSignOutAction}>
                <button type="submit" className="text-sm font-medium text-signal hover:text-signal-hover">
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/sign-in"
              className="border-l border-line pl-6 text-sm font-medium text-signal hover:text-signal-hover"
            >
              Sign in
            </Link>
          )}
        </nav>

        <MobileNavToggle
          links={navLinks}
          session={session ? { name: session.name } : null}
          signOutAction={devSignOutAction}
        />
      </div>
    </header>
  )
}
