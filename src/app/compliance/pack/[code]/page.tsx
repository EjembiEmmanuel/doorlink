import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { findDocument } from '@/lib/compliance/catalogue'
import { contentFor } from '@/lib/compliance/content'
import { packGate } from '../guard'
import { GateNotice } from '../GateNotice'
import { DocumentView } from '../DocumentView'
import { PrintButton } from '@/components/ui/PrintButton'
import '../compliance-print.css'

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params
  const doc = findDocument(code.toUpperCase())
  return { title: doc ? `${doc.code} — ${doc.title}` : 'Document' }
}

export default async function ComplianceDocumentPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const meta = findDocument(code.toUpperCase())
  if (!meta) notFound()

  const content = contentFor(meta.code)
  if (!content) notFound()

  const gate = await packGate()
  if (gate.state === 'signed-out') redirect('/sign-in')
  if (gate.state !== 'ok') return <GateNotice gate={gate} />

  return (
    <div className="py-6">
      <div className="cp-hide-print mx-auto mb-5 flex max-w-shell flex-wrap items-center justify-between gap-3 px-4">
        <Link href="/compliance/pack" className="text-sm font-medium text-signal hover:text-signal-hover">
          <span aria-hidden="true">← </span>All documents
        </Link>
        <PrintButton />
      </div>

      <DocumentView meta={meta} content={content} profile={gate.profile} />
    </div>
  )
}
