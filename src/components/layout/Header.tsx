import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { devSignOutAction } from '@/lib/dev-session'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { MobileNavToggle } from './MobileNavToggle'

const NAV_LINKS = [
  { href: '/find', label: 'Find your part' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/data-sources', label: 'Data sources' },
]

async function getCartItemCount(userId: string): Promise<number> {
  try {
    return await prisma.cartItem.count({ where: { cart: { userId } } })
  } catch (error) {
    // The header renders on every page — a cart count that can't be
    // fetched just doesn't show a number, it doesn't take the header down.
    if (isDatabaseUnreachable(error)) return 0
    throw error
  }
}

export async function Header() {
  const session = await getSession()
  const navLinks = [...NAV_LINKS]
  if (session) {
    const cartCount = await getCartItemCount(session.userId)
    navLinks.push({ href: '/cart', label: cartCount > 0 ? `Cart (${cartCount})` : 'Cart' })
  }
  if (session && can(session.role, 'listing:write:own')) {
    navLinks.push({ href: '/my-listings', label: 'My listings' })
  }
  if (session && can(session.role, 'catalogue:write')) {
    navLinks.push({ href: '/admin', label: 'Admin' })
  }

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
