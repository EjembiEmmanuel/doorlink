import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { COMPLIANCE_DOCUMENTS } from '@/lib/compliance/catalogue'
import { contentFor } from '@/lib/compliance/content'
import { packGate } from '../guard'
import { GateNotice } from '../GateNotice'
import { DocumentView } from '../DocumentView'
import { PrintButton } from '../PrintButton'
import '../compliance-print.css'

export const metadata: Metadata = { title: 'Compliance & Safety Pack: all documents' }

/**
 * Every transcribed document on one page, each starting a new sheet when
 * printed. This is how the pack is saved as a single PDF.
 */
export default async function WholePackPage() {
  const gate = await packGate()
  if (gate.state === 'signed-out') redirect('/sign-in')
  if (gate.state !== 'ok') return <GateNotice gate={gate} />

  const documents = COMPLIANCE_DOCUMENTS.map((meta) => ({ meta, content: contentFor(meta.code) })).filter(
    (
      entry
    ): entry is {
      meta: (typeof COMPLIANCE_DOCUMENTS)[number]
      content: NonNullable<ReturnType<typeof contentFor>>
    } => entry.content !== null
  )

  const missing = COMPLIANCE_DOCUMENTS.length - documents.length

  return (
    <div className="py-6">
      <div className="cp-hide-print mx-auto mb-5 flex max-w-shell flex-col gap-3 px-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/compliance/pack" className="text-sm font-medium text-signal hover:text-signal-hover">
            <span aria-hidden="true">← </span>All documents
          </Link>
          <PrintButton label="Print or save the whole pack as PDF" />
        </div>
        <p className="text-sm text-zinc-deep">
          {documents.length} of {COMPLIANCE_DOCUMENTS.length} documents.
          {missing > 0 &&
            ` The other ${missing} are still being transferred into Doorlink and are not included here.`}{' '}
          Each one starts a new page when printed.
        </p>
      </div>

      {documents.map(({ meta, content }) => (
        <DocumentView key={meta.code} meta={meta} content={content} profile={gate.profile} />
      ))}
    </div>
  )
}
