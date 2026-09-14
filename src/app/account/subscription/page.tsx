import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { formatMoney } from '@/lib/money'
import { paymentsAvailable } from '@/lib/payments'
import { entitlementsFor, FEATURE_LABELS } from '@/lib/entitlements'
import { NotConnected } from '@/components/ui/NotConnected'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { SUBSCRIPTION_STATUS_LABELS } from '@/lib/labels'

export const metadata: Metadata = { title: 'Subscription' }

const INTERVAL_SUFFIX = { WEEK: 'per week', MONTH: 'per month', YEAR: 'per year' } as const

export default async function SubscriptionPage() {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  let history
  try {
    history = await prisma.subscription.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    })
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return (
      <div className="mx-auto max-w-shell px-4 py-10">
        <NotConnected feature="Your subscription" reason="Can't reach the database right now." />
      </div>
    )
  }

  const entitlements = await entitlementsFor(session.userId)
  const live = paymentsAvailable()
  const current = history.find((row) => row.status === entitlements.status) ?? null

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <nav className="mb-6 text-sm">
        <Link href="/account" className="font-medium text-signal hover:text-signal-hover">
          Account
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-graphite">Subscription</h1>
      </header>

      <section className="mb-10">
        {current ? (
          <div className="rounded-md border border-line bg-paper p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-graphite">{current.plan.name}</p>
                <p className="mt-1 text-sm text-zinc-deep">
                  {current.plan.priceCents !== null
                    ? `${formatMoney(current.plan.priceCents, current.plan.currency)} ${INTERVAL_SUFFIX[current.plan.interval]}`
                    : 'Pricing not set'}
                </p>
              </div>
              <Badge tone={current.status === 'ACTIVE' || current.status === 'TRIALING' ? 'good' : 'caution'}>
                {SUBSCRIPTION_STATUS_LABELS[current.status]}
              </Badge>
            </div>

            {current.currentPeriodEnd && (
              <p className="mt-4 text-sm text-graphite-soft">
                {current.cancelAtPeriodEnd ? 'Access ends' : 'Renews'} on{' '}
                {current.currentPeriodEnd.toLocaleDateString('en-AU', { dateStyle: 'long' })}.
              </p>
            )}
          </div>
        ) : (
          <EmptyState
            title="You're on the free plan"
            description="Everything in Doorlink is available to you right now — nothing is behind the subscription yet."
          />
        )}
      </section>

      {/* Upgrade / downgrade / cancel are provider operations. Rendering
          them as buttons that cannot do anything would be worse than
          saying, once, that the provider is not connected. */}
      {!live && (
        <div className="mb-10">
          <NotConnected
            feature="Changing your plan"
            reason="Upgrading, downgrading and cancelling all happen through the payment provider, and none is connected yet. When Stripe is wired in, these become live without any other change to this page."
          />
        </div>
      )}

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-deep">
          What your plan affects
        </h2>
        {entitlements.gated.size === 0 ? (
          <p className="text-graphite-soft">
            Nothing, today. No feature is gated behind a subscription — which features become premium is an
            admin setting, not something compiled into the app, so it can be decided once the business model is.{' '}
            <Link href="/plans" className="font-medium text-signal hover:text-signal-hover">
              See the plans
            </Link>
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {[...entitlements.gated].map((feature) => (
              <li
                key={feature}
                className="flex items-center justify-between rounded-md border border-line bg-paper px-4 py-3 text-sm"
              >
                <span className="text-graphite">{FEATURE_LABELS[feature]}</span>
                <Badge tone={entitlements.has(feature) ? 'good' : 'neutral'}>
                  {entitlements.has(feature) ? 'Included' : 'Needs a subscription'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-deep">
          Subscription history
        </h2>
        {history.length === 0 ? (
          <EmptyState title="Nothing yet" />
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md border border-line bg-paper px-4 py-3 text-sm"
              >
                <span className="text-graphite">{row.plan.name}</span>
                <span className="flex items-center gap-3">
                  <span className="text-micro text-zinc-deep">
                    started {row.createdAt.toLocaleDateString('en-AU', { dateStyle: 'medium' })}
                  </span>
                  <Badge tone="neutral">{SUBSCRIPTION_STATUS_LABELS[row.status]}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
