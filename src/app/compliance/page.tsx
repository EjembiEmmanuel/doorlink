import type { Metadata } from 'next'
import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { formatMoney } from '@/lib/money'
import { paymentsAvailable } from '@/lib/payments'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import {
  COMPLIANCE_DISCLAIMER,
  DOCUMENT_COUNT,
  SECTION_COUNT,
  TOTAL_PAGES,
  documentsBySection,
} from '@/lib/compliance/catalogue'
import { currentCompliancePriceCents } from '@/lib/compliance/pricing-settings'
import { COMPLIANCE_CURRENCY } from '@/lib/compliance/pricing'
import { complianceAccess } from '@/lib/compliance/entitlement'
import { completeness } from '@/lib/compliance/profile'
import { Panel, PanelBody } from '@/components/ui/Panel'
import { Badge } from '@/components/ui/Badge'
import { PurchaseButton } from './PurchaseButton'

export const metadata: Metadata = {
  title: 'Compliance & Safety Pack',
  description:
    'Fifteen compliance and safety templates for the door, gate and shutter trade, branded with your business details.',
}

export default async function CompliancePage() {
  const session = await getSession()
  const priceCents = await currentCompliancePriceCents()
  const canPay = paymentsAvailable()

  let access = { granted: false, known: true, purchasedAt: null as Date | null }
  let profileReady = false

  if (session) {
    access = await complianceAccess(session.userId)
    try {
      const profile = await prisma.complianceProfile.findUnique({ where: { userId: session.userId } })
      profileReady = completeness(profile).canIssue
    } catch (error) {
      if (!isDatabaseUnreachable(error)) throw error
    }
  }

  const sections = documentsBySection()

  return (
    <div className="mx-auto flex max-w-shell flex-col gap-10 px-4 py-10">
      <header className="flex flex-col gap-4">
        <Badge tone="signal">Add-on</Badge>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-graphite sm:text-4xl">
          Compliance &amp; Safety Pack
        </h1>
        <p className="max-w-prose text-graphite-soft">
          {DOCUMENT_COUNT} documents across {SECTION_COUNT} sections, written for the door, gate and shutter
          trade. Fill in your business details once and every document carries your logo, your ABN, your
          insurances and your signature block.
        </p>

        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <span className="text-3xl font-semibold text-graphite">
            {formatMoney(priceCents, COMPLIANCE_CURRENCY)}
          </span>
          <span className="text-sm text-zinc-deep">One-off payment · {TOTAL_PAGES} pages · A4</span>
        </div>

        {access.granted ? (
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="good">Purchased</Badge>
            <Link
              href={profileReady ? '/compliance/pack' : '/compliance/details'}
              className="font-medium text-signal hover:text-signal-hover"
            >
              {profileReady ? 'Open your pack' : 'Add your business details'}
              <span aria-hidden="true"> →</span>
            </Link>
          </div>
        ) : !access.known ? (
          <p className="text-sm text-caution">
            Your purchase could not be confirmed right now because the database is unreachable. This is not a
            statement that you have not bought it — try again shortly.
          </p>
        ) : (
          <PurchaseButton signedIn={Boolean(session)} canPay={canPay} />
        )}

        {/* Someone deciding whether to spend money on documents should be
            able to read them first. Deliberately not called "the pack":
            this is the unbranded master the documents were written from,
            and it runs to a different page count than the {TOTAL_PAGES}
            advertised above, which Doorlink generates from its own
            catalogue. Calling two different artefacts by one name on a
            compliance product is the kind of small inaccuracy this
            page's own caution panel exists to avoid. */}
        <div className="flex flex-col gap-1">
          <a
            href="/downloads/doorlink-compliance-safety-pack.pdf"
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-signal hover:text-signal-hover"
          >
            Read the source documents before buying (PDF)
            <span aria-hidden="true"> →</span>
          </a>
          <p className="text-micro text-zinc-deep">
            The unbranded master these templates are written from. What you buy is Doorlink&rsquo;s
            version, carrying your business details.
          </p>
        </div>
      </header>

      {/* Said before the money, not after. Someone deciding whether to buy
          a compliance product needs to know it is a template pack rather
          than a compliance service. */}
      <Panel className="border-caution/30 bg-caution-tint">
        <PanelBody className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-caution">What this is, and what it is not</h2>
          <p className="max-w-prose text-sm text-graphite">
            These are templates. They give you a consistent structure and a starting point drawn from common
            practice in the trade. They are not legal advice, they are not a substitute for a competent person
            assessing your actual worksites, and completing them does not by itself make a business compliant.
          </p>
          <p className="max-w-prose text-sm text-graphite">
            Doorlink holds the New South Wales legislation list. If you work in another state, the documents
            will say so and leave the state instruments for you to add rather than citing the wrong ones.
          </p>
        </PanelBody>
      </Panel>

      <section className="flex flex-col gap-5">
        <h2 className="text-lg font-semibold text-graphite">What is in the pack</h2>

        <div className="flex flex-col gap-6">
          {sections.map(({ section, documents }) => (
            <div key={section.number} className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-deep">
                {section.number} {section.title}
              </h3>
              <ul className="flex flex-col gap-3">
                {documents.map((doc) => (
                  <li key={doc.code}>
                    <Panel>
                      <PanelBody className="flex flex-col gap-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-code text-micro text-zinc-deep">{doc.code}</span>
                          <h4 className="font-medium text-graphite">{doc.title}</h4>
                          <span className="text-micro text-zinc-deep">
                            {doc.pages} {doc.pages === 1 ? 'page' : 'pages'}
                          </span>
                          {doc.jurisdictionSpecific && <Badge tone="caution">State-specific</Badge>}
                          {doc.needsProfessionalReview && (
                            <Badge tone="caution">Needs professional review</Badge>
                          )}
                        </div>
                        <p className="max-w-prose text-sm text-zinc-deep">{doc.purpose}</p>
                      </PanelBody>
                    </Panel>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-line pt-6">
        <p className="max-w-prose text-micro text-zinc-deep">{COMPLIANCE_DISCLAIMER}</p>
      </footer>
    </div>
  )
}
