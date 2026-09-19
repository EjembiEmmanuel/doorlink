import type { Metadata } from 'next'
import Link from 'next/link'
import { Panel, PanelBody } from '@/components/ui/Panel'

export const metadata: Metadata = {
  title: "I don't know my model",
  description: 'How to identify a garage door opener, motor, or lock without knowing its model number.',
  alternates: { canonical: '/find/unknown' },
}

const TIPS = [
  {
    title: 'Check the data plate',
    body: 'Most openers and motors have a metal or printed plate near the power cable or motor head with a model code and serial number.',
  },
  {
    title: 'Look at the remote',
    body: 'The remote or wall control often carries the same brand name as the door operator, printed on the back near the battery cover.',
  },
  {
    title: 'Photograph the whole unit',
    body: 'If nothing is legible, a clear photo of the motor head, rail and any control board is usually enough for a technician to identify it.',
  },
]

export default function FindUnknownPage() {
  return (
    <div className="mx-auto max-w-prose px-4 py-12">
      <h1 className="text-2xl font-semibold text-graphite">Don&apos;t know your model?</h1>
      <p className="mt-2 text-graphite-soft">
        Try these first. Most products can still be identified without the exact model number.
      </p>

      <ul className="mt-8 flex flex-col gap-4">
        {TIPS.map((tip) => (
          <li key={tip.title}>
            <Panel>
              <PanelBody>
                <p className="font-medium text-graphite">{tip.title}</p>
                <p className="mt-1 text-sm text-graphite-soft">{tip.body}</p>
              </PanelBody>
            </Panel>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm text-graphite-soft">
        Found something? Head back to the{' '}
        <Link href="/find" className="font-medium text-signal hover:text-signal-hover">
          finder
        </Link>{' '}
        and work through category and manufacturer instead of model number.
      </p>
    </div>
  )
}
