import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { isConnected } from '@/lib/integrations'
import { formatMoney, sumMinorUnits } from '@/lib/money'
import { EmptyState } from '@/components/ui/EmptyState'
import { NotConnected } from '@/components/ui/NotConnected'
import { CartItemControls } from './CartItemControls'

export const metadata: Metadata = {
  title: 'Your cart',
}

export default async function CartPage() {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  let cart
  try {
    cart = await prisma.cart.findUnique({
      where: { userId: session.userId },
      include: {
        items: {
          include: {
            listing: {
              include: {
                model: { select: { id: true, name: true, modelCode: true } },
                organization: { select: { name: true } },
              },
            },
          },
        },
      },
    })
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return (
      <div className="mx-auto max-w-shell px-4 py-12">
        <NotConnected feature="Your cart" reason="Can't load your cart right now." />
      </div>
    )
  }

  const items = cart?.items ?? []
  const total = sumMinorUnits(...items.map((item) => item.listing.priceCents * item.quantity))

  return (
    <div className="mx-auto max-w-shell px-4 py-10">
      <h1 className="text-2xl font-semibold text-graphite">Your cart</h1>

      {items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Your cart is empty"
            description="Add something from the marketplace to see it here."
            action={
              <Link href="/marketplace" className="mt-2 inline-block text-sm font-medium text-signal hover:text-signal-hover">
                Browse the marketplace
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-6">
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col items-start justify-between gap-4 rounded-md border border-line p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="font-code text-sm text-zinc-deep">{item.listing.model.modelCode}</p>
                  <Link
                    href={`/model/${item.listing.model.id}`}
                    className="font-medium text-graphite hover:text-signal"
                  >
                    {item.listing.title}
                  </Link>
                  <p className="text-sm text-zinc-deep">
                    Sold by {item.listing.organization.name} ·{' '}
                    {formatMoney(item.listing.priceCents, item.listing.currency)} each
                  </p>
                </div>
                <CartItemControls itemId={item.id} quantity={item.quantity} />
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between border-t border-line pt-4">
            <p className="text-lg font-semibold text-graphite">Total: {formatMoney(total)}</p>
          </div>

          {isConnected('payments') ? (
            <button
              type="button"
              className="inline-flex h-11 w-fit items-center justify-center rounded bg-signal px-6 text-sm font-medium text-paper hover:bg-signal-hover"
            >
              Checkout
            </button>
          ) : (
            <NotConnected
              feature="Checkout"
              reason="Stripe isn't configured yet, so orders can't actually be placed — this cart is fully functional, but demo-only until then."
            />
          )}
        </div>
      )}
    </div>
  )
}
