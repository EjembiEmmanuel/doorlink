import type { Metadata } from 'next'
import Link from 'next/link'
import { Panel, PanelBody } from '@/components/ui/Panel'

export const metadata: Metadata = {
  title: 'Tools',
  description: 'Calculators and reference tools for garage door technicians.',
  alternates: { canonical: '/tools' },
}

// An index rather than a single hard-coded route, so the next
// calculator is an entry here instead of another top-level nav item.
const TOOLS = [
  {
    href: '/tools/spring-calculator',
    title: 'Spring calculator',
    description:
      'Estimate torsion and extension spring requirements from the door weight or from an existing spring.',
  },
]

export default function ToolsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-graphite">Tools</h1>
      <p className="mt-2 max-w-prose text-sm text-graphite-soft">
        Working calculators for the measurements technicians actually take on site.
      </p>

      <ul className="mt-6 flex flex-col gap-3">
        {TOOLS.map((tool) => (
          <li key={tool.href}>
            <Link href={tool.href} className="block">
              <Panel className="transition-colors hover:border-signal">
                <PanelBody>
                  <p className="font-medium text-graphite">{tool.title}</p>
                  <p className="mt-1 text-sm text-graphite-soft">{tool.description}</p>
                </PanelBody>
              </Panel>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
