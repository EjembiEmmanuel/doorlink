import type { Metadata } from 'next'
import { CompliancePackConfigurator } from '@/components/compliance/CompliancePackConfigurator'

export const metadata: Metadata = {
  title: 'Compliance & Safety Pack',
  description:
    'A professionally formatted compliance and safety documentation pack for the door, gate and shutter industry.',
  alternates: { canonical: '/compliance-pack' },
}

export default function CompliancePackPage() {
  return (
    <div className="mx-auto max-w-shell px-4 py-10 sm:py-14">
      <header className="max-w-3xl">
        <p className="font-code text-micro font-semibold uppercase tracking-[0.18em] text-signal">
          Doorlink add-on / digital documentation
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-graphite sm:text-5xl">
          Compliance &amp; Safety Pack
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-graphite-soft">
          A reliable, professionally aligned documentation pack for door, gate and shutter businesses. Add your
          business details and logo to your working copy, then send the finished documents to your clients.
        </p>
      </header>

      <CompliancePackConfigurator />
    </div>
  )
}