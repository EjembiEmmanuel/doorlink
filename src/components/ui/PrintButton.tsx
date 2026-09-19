'use client'

import { Button } from './Button'

/**
 * Saving a document as a PDF is the browser's own print-to-PDF, not an
 * export endpoint. That is a real capability rather than a stand-in: the
 * page's print stylesheet sets A4 pages, page breaks and running
 * footers, so what comes out is a proper document. It also means no PDF
 * library, no server render and no file storage — none of which are
 * connected.
 *
 * The label says "Print or save as PDF" rather than "Download PDF",
 * because what happens next is the browser's print dialog, and a button
 * that promises a download and opens a dialog is a small lie.
 */
export function PrintButton({ label = 'Print or save as PDF' }: { label?: string }) {
  return (
    <Button type="button" onClick={() => window.print()}>
      {label}
    </Button>
  )
}
