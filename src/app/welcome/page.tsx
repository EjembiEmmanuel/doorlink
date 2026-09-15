import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Role } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { onboardingFor, type OnboardingStep } from '@/lib/onboarding'
import { NotConnected } from '@/components/ui/NotConnected'
import { Panel, PanelBody } from '@/components/ui/Panel'
import { Badge } from '@/components/ui/Badge'

export const metadata: Metadata = {
  title: 'Getting started',
  description: 'What is left to set up on your Doorlink account.',
}

const HEADING: Record<Role, string> = {
  CUSTOMER: 'Getting started',
  TECHNICIAN: 'Setting up your trade profile',
  SUPPLIER: 'Setting up your shop',
  MANUFACTURER: 'Your manufacturer account',
  ADMIN: 'Your queues',
}

export default async function WelcomePage() {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  const onboarding = await onboardingFor(session)

  if (!onboarding) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <NotConnected
          feature="Getting started"
          reason="This checklist is counted from your account each time you open it, and the database can't be reached right now."
        />
      </div>
    )
  }

  const isAdmin = session.role === Role.ADMIN

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold text-graphite">{HEADING[session.role]}</h1>
        <p className="max-w-prose text-sm text-zinc-deep">{onboarding.summary}</p>

        {!isAdmin && (
          <p className="text-sm text-graphite-soft">
            <span className="font-medium text-graphite">
              {onboarding.done} of {onboarding.total}
            </span>{' '}
            done.{' '}
            {onboarding.complete
              ? 'Nothing else is needed — the rest is optional.'
              : 'Each item is checked against your account when this page loads, so it stays accurate.'}
          </p>
        )}
      </header>

      <ol className="flex flex-col gap-3">
        {onboarding.steps.map((step, index) => (
          <li key={step.key}>
            <StepRow step={step} index={index} showNumber={!isAdmin} />
          </li>
        ))}
      </ol>

      <footer className="border-t border-line pt-6">
        <p className="text-sm text-zinc-deep">
          You can leave this and come back — nothing here expires.{' '}
          <Link href="/account" className="font-medium text-signal hover:text-signal-hover">
            Go to your account
          </Link>
          .
        </p>
      </footer>
    </div>
  )
}

function StepRow({ step, index, showNumber }: { step: OnboardingStep; index: number; showNumber: boolean }) {
  return (
    <Panel className={step.done ? 'border-line/70' : undefined}>
      <PanelBody className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <Marker done={step.done} index={index} showNumber={showNumber} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={step.done ? 'font-medium text-graphite-soft' : 'font-medium text-graphite'}>
              {step.title}
            </h2>
            {step.optional && !step.done && <Badge tone="neutral">Optional</Badge>}
            {/* Said plainly, because the account holder cannot clear this
                one themselves and a plain unticked box would read as
                something they had forgotten to do. */}
            {step.waitingOnDoorlink && <Badge tone="caution">With Doorlink</Badge>}
          </div>

          <p className="mt-1 text-sm text-zinc-deep">{step.description}</p>

          <Link
            href={step.href}
            className="mt-3 inline-flex text-sm font-medium text-signal hover:text-signal-hover"
          >
            {step.cta}
            <span aria-hidden="true"> →</span>
          </Link>
        </div>
      </PanelBody>
    </Panel>
  )
}

function Marker({ done, index, showNumber }: { done: boolean; index: number; showNumber: boolean }) {
  if (done) {
    return (
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-good/10 text-good"
        aria-label="Done"
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
          <path
            d="M3.5 8.5l3 3 6-6"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    )
  }

  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-micro font-medium text-graphite-soft"
      aria-label="Not done yet"
    >
      {showNumber ? index + 1 : ''}
    </span>
  )
}
