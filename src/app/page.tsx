import type { Metadata } from 'next'
import Link from 'next/link'
import { FinderCascade } from '@/components/finder/FinderCascade'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel'
import { DoorHero3DClientOnly } from '@/components/three/DoorHero3DClientOnly'
import { RevealCard } from '@/components/ui/RevealCard'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

export default function HomePage() {
  return (
    <div className="mx-auto max-w-shell px-4 py-10 sm:py-16">
      <div className="mb-12 grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="max-w-prose">
          <h1 className="text-display font-semibold tracking-tight text-graphite sm:text-display-lg">
            Everything for your door, in one place.
          </h1>
          <p className="mt-4 text-lg text-graphite-soft">
            Identify your garage door, roller shutter, motor or lock, then find the manual, the
            compatible parts and the people who can fit them.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/find"
              className="rounded-full bg-signal px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-signal-hover"
            >
              Find your part
            </Link>
            <Link
              href="/request-technician"
              className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-graphite transition-colors hover:bg-rail"
            >
              Request a technician
            </Link>
          </div>
        </div>

        <DoorHero3DClientOnly />
      </div>

      <div className="mb-12 grid gap-4 sm:grid-cols-3">
        {[
          {
            step: '1',
            title: 'Identify',
            body: 'Tell us your model, or answer a few quick questions if you don’t know it.',
          },
          {
            step: '2',
            title: 'Compare & connect',
            body: 'See compatible parts and documents, or browse the marketplace for one nearby.',
          },
          {
            step: '3',
            title: 'Get it sorted',
            body: 'Request a technician, or message a seller directly — no accounts, no middleman.',
          },
        ].map((item, i) => (
          <RevealCard key={item.step} delay={i * 0.08} className="rounded-md border border-line bg-paper p-5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-graphite text-xs font-semibold text-paper">
              {item.step}
            </span>
            <p className="mt-3 font-medium text-graphite">{item.title}</p>
            <p className="mt-1 text-sm text-zinc-deep">{item.body}</p>
          </RevealCard>
        ))}
      </div>

      <Panel className="mb-12">
        <PanelHeader>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-deep">Find your product</h2>
        </PanelHeader>
        <PanelBody>
          <FinderCascade />
        </PanelBody>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2">
        <RevealCard>
          <Link href="/find/unknown" className="block rounded-md border border-line p-5 transition-colors hover:border-signal">
            <p className="font-medium text-graphite">Don&apos;t know your model?</p>
            <p className="mt-1 text-sm text-zinc-deep">
              Answer a few questions about what you can see on the door instead.
            </p>
          </Link>
        </RevealCard>
        <RevealCard delay={0.08}>
          <Link href="/data-sources" className="block rounded-md border border-line p-5 transition-colors hover:border-signal">
            <p className="font-medium text-graphite">Where this data comes from</p>
            <p className="mt-1 text-sm text-zinc-deep">
              Every record is labelled with its source — nothing here pretends to be verified.
            </p>
          </Link>
        </RevealCard>
      </div>
    </div>
  )
}
