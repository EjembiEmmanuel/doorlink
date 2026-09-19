'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { DOCUMENT_KIND_LABELS } from '@/lib/labels'
import { submitManualAction, type ManualSubmissionState } from './actions'

const initialState: ManualSubmissionState = {}

const KIND_OPTIONS = Object.entries(DOCUMENT_KIND_LABELS) as Array<[keyof typeof DOCUMENT_KIND_LABELS, string]>

export function SubmitManualForm() {
  const [state, formAction, isPending] = useActionState(submitManualAction, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Document title" htmlFor="title">
          <Input id="title" name="title" required maxLength={160} placeholder="For example, BFT Deimos BT A user manual" />
        </Field>
        <Field label="Document type" htmlFor="kind">
          <Select id="kind" name="kind" defaultValue="USER_MANUAL">
            {KIND_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Manufacturer" htmlFor="manufacturer" hint="Optional, if shown on the document.">
          <Input id="manufacturer" name="manufacturer" maxLength={120} />
        </Field>
        <Field label="Model or document code" htmlFor="modelCode" hint="Optional, use the exact code printed on the file.">
          <Input id="modelCode" name="modelCode" maxLength={120} />
        </Field>
      </div>

      <Field
        label="Public document link"
        htmlFor="sourceUrl"
        hint="Link to a PDF or document page that reviewers can open without an account."
      >
        <Input id="sourceUrl" name="sourceUrl" type="url" required placeholder="https://example.com/manual.pdf" />
      </Field>

      <Field
        label="Notes for the reviewer"
        htmlFor="notes"
        hint="Tell us what product the manual belongs to, or anything that helps confirm its source."
      >
        <Textarea id="notes" name="notes" rows={5} maxLength={2000} />
      </Field>

      {state.error && (
        <p role="alert" className="rounded-md border border-bad/30 bg-bad/5 p-3 text-sm text-bad">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-graphite bg-graphite p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <p className="max-w-prose text-sm text-paper/70">
          Submissions are reviewed before they appear in the public library. A link is used here because
          document storage uploads are not connected yet.
        </p>
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? 'Sending...' : 'Submit for review'}
        </Button>
      </div>
    </form>
  )
}