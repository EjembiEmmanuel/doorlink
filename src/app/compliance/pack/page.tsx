import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { NotConnected } from '@/components/ui/NotConnected'
import { Panel, PanelBody } from '@/components/ui/Panel'
import { Badge } from '@/components/ui/Badge'
import { complianceAccess } from '@/lib/compliance/entitlement'
import { completeness } from '@/lib/compliance/profile'
import { documentsBySection } from '@/lib/compliance/catalogue'
import { availableCodes } from '@/lib/compliance/content'

export const metadata: Metadata = { title: 'Your Compliance & Safety Pack' }

export default async function CompliancePackPage() {
  const session = await getSession()
  if (!session) redirect('/sign-in')

  const access = await complianceAccess(session.userId)

  if (!access.known) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <NotConnected
          feature="Your pack"
          reason="Your purchase could not be confirmed because the database is unreachable. This is not a statement that you have not bought it."
        />
      </div>
    )
  }

  if (!access.granted) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-16">
        <h1 className="text-2xl font-semibold text-graphite">You do not have this pack yet</h1>
        <p className="max-w-prose text-graphite-soft">The Compliance &amp; Safety Pack is a paid add-on.</p>
        <Link href="/compliance" className="font-medium text-signal hover:text-signal-hover">
          See what is in it<span aria-hidden="true"> →</span>
        </Link>
      </div>
    )
  }

  let profile
  try {
    profile = await prisma.complianceProfile.findUnique({ where: { userId: session.userId } })
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <NotConnected feature="Your pack" reason="Can't reach the database right now." />
      </div>
    )
  }

  const status = completeness(profile)
  const ready = new Set(availableCodes())

  return (
    <div className="mx-auto flex max-w-shell flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-graphite">
          Your Compliance &amp; Safety Pack
        </h1>
        <p className="max-w-prose text-graphite-soft">
          Each document opens branded with your business details. Use your browser&apos;s print dialog to save
          one as a PDF, or open the whole pack and save it in one go.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/compliance/details" className="font-medium text-signal hover:text-signal-hover">
            Edit your details<span aria-hidden="true"> →</span>
          </Link>
          {status.canIssue && (
            <Link href="/compliance/pack/all" className="font-medium text-signal hover:text-signal-hover">
              Open the whole pack<span aria-hidden="true"> →</span>
            </Link>
          )}
        </div>
      </header>

      {!status.canIssue && (
        <Panel className="border-caution/30 bg-caution-tint">
          <PanelBody className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-caution">Add your details before issuing a document</h2>
            <p className="max-w-prose text-sm text-graphite">
              A compliance document with your name on it and blanks where the ABN, the emergency contact or the
              approval signature belong still looks official. These are missing:
            </p>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-graphite">
              {status.missingRequired.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
            <Link href="/compliance/details" className="font-medium text-signal hover:text-signal-hover">
              Fill them in<span aria-hidden="true"> →</span>
            </Link>
          </PanelBody>
        </Panel>
      )}

      <div className="flex flex-col gap-6">
        {documentsBySection().map(({ section, documents }) => (
          <section key={section.number} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-deep">
              {section.number} {section.title}
            </h2>
            <ul className="flex flex-col gap-3">
              {documents.map((doc) => {
                const available = ready.has(doc.code)
                return (
                  <li key={doc.code}>
                    <Panel>
                      <PanelBody className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-code text-micro text-zinc-deep">{doc.code}</span>
                          <h3 className="font-medium text-graphite">{doc.title}</h3>
                          {doc.jurisdictionSpecific && <Badge tone="caution">State-specific</Badge>}
                          {!available && <Badge tone="neutral">Not yet available</Badge>}
                        </div>
                        <p className="max-w-prose text-sm text-zinc-deep">{doc.purpose}</p>
                        {available ? (
                          status.canIssue ? (
                            <Link
                              href={`/compliance/pack/${doc.code}`}
                              className="text-sm font-medium text-signal hover:text-signal-hover"
                            >
                              Open<span aria-hidden="true"> →</span>
                            </Link>
                          ) : (
                            <span className="text-sm text-zinc-deep">
                              Available once your details are complete.
                            </span>
                          )
                        ) : (
                          // Stated rather than hidden: a document silently
                          // missing from a pack someone paid for is worse
                          // than one marked as still being transferred.
                          <span className="text-sm text-zinc-deep">
                            This document&apos;s content is still being transferred into Doorlink.
                          </span>
                        )}
                      </PanelBody>
                    </Panel>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
