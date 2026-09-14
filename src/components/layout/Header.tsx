import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { devSignOutAction } from '@/lib/dev-session'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { MobileNavToggle } from './MobileNavToggle'
import { AccountMenu } from './AccountMenu'

const NAV_LINKS = [
  { href: '/find', label: 'Find your part' },
  { href: '/manuals', label: 'Manuals' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/request-technician', label: 'Request a technician' },
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
  const accountLinks: { href: string; label: string }[] = []

  if (session) {
    const cartCount = await getCartItemCount(session.userId)
    accountLinks.push({ href: '/cart', label: cartCount > 0 ? `Cart (${cartCount})` : 'Cart' })
    accountLinks.push({ href: '/account', label: 'Account' })
    if (can(session.role, 'listing:write:own')) {
      accountLinks.push({ href: '/my-listings', label: 'My listings' })
    }
    if (can(session.role, 'lead:write:own') || can(session.role, 'lead:write:any')) {
      accountLinks.push({ href: '/leads', label: 'Requests' })
    }
    accountLinks.push({ href: '/support', label: 'Support' })
    if (can(session.role, 'catalogue:write')) {
      accountLinks.push({ href: '/admin', label: 'Admin' })
    }
  }

  // The mobile hamburger still shows everything flat — on a phone there's
  // no crowded single row to protect, and the bottom tab bar already
  // covers the handful of destinations worth one tap.
  const mobileLinks = [...NAV_LINKS, ...accountLinks]

  return (
    <header className="relative border-b border-line bg-paper">
      <div className="mx-auto flex h-16 max-w-shell items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-graphite">
          DoorLink
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm font-medium text-graphite hover:text-signal">
              {link.label}
            </Link>
          ))}
          {session ? (
            <AccountMenu name={session.name} links={accountLinks} signOutAction={devSignOutAction} />
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
          links={mobileLinks}
          session={session ? { name: session.name } : null}
          signOutAction={devSignOutAction}
        />
      </div>
    </header>
  )
}
