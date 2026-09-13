import Link from 'next/link'
import { FinderCascade } from '@/components/finder/FinderCascade'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel'

export default function HomePage() {
  return (
    <div className="mx-auto max-w-shell px-4 py-10 sm:py-16">
      <div className="mb-10 max-w-prose">
        <h1 className="text-display font-semibold tracking-tight text-graphite sm:text-display-lg">
          Everything for your door, in one place.
        </h1>
        <p className="mt-4 text-lg text-graphite-soft">
          Identify your garage door, roller shutter, motor or lock, then find the manual, the
          compatible parts and the people who can fit them.
        </p>
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
        <Link href="/find/unknown" className="block rounded-md border border-line p-5 hover:border-signal">
          <p className="font-medium text-graphite">Don&apos;t know your model?</p>
          <p className="mt-1 text-sm text-zinc-deep">
            Answer a few questions about what you can see on the door instead.
          </p>
        </Link>
        <Link href="/data-sources" className="block rounded-md border border-line p-5 hover:border-signal">
          <p className="font-medium text-graphite">Where this data comes from</p>
          <p className="mt-1 text-sm text-zinc-deep">
            Every record is labelled with its source — nothing here pretends to be verified.
          </p>
        </Link>
      </div>
    </div>
  )
}
