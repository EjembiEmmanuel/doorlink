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
    <form action={formAction} encType="multipart/form-data" className="flex flex-col gap-5">
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

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Product name" htmlFor="productName" hint="Optional, if different from the model code.">
          <Input id="productName" name="productName" maxLength={160} />
        </Field>
        <Field label="Product type" htmlFor="productType" hint="For example, sliding gate operator.">
          <Input id="productType" name="productType" maxLength={120} />
        </Field>
      </div>

      <Field
        label="Public document link"
        htmlFor="sourceUrl"
        hint="Optional if you upload a file. Use a link reviewers can open without an account."
      >
        <Input id="sourceUrl" name="sourceUrl" type="url" placeholder="https://example.com/manual.pdf" />
      </Field>

      <Field
        label="Document file"
        htmlFor="file"
        hint="Optional if you provide a link. Uploads require connected document storage and are limited to 25 MB."
      >
        <Input id="file" name="file" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" />
      </Field>

      <Field label="What should reviewers know?" htmlFor="description">
        <Textarea id="description" name="description" rows={3} maxLength={1000} />
      </Field>

      <Field
        label="Notes for the reviewer"
        htmlFor="notes"
        hint="Tell us what product the manual belongs to, or anything that helps confirm its source."
      >
        <Textarea id="notes" name="notes" rows={5} maxLength={2000} />
      </Field>

      <label className="flex items-start gap-3 rounded-md border border-line bg-rail p-4 text-sm text-graphite">
        <input
          type="checkbox"
          name="rightsAcknowledged"
          required
          className="mt-0.5 h-4 w-4 accent-signal"
        />
        <span>
          I have permission to share this document or link it for review, and I understand that approval
          does not guarantee Doorlink will host a copy.
        </span>
      </label>

      {state.error && (
        <p role="alert" className="rounded-md border border-bad/30 bg-bad/5 p-3 text-sm text-bad">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-graphite bg-graphite p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <p className="max-w-prose text-sm text-paper/70">
          Submissions are checked and approved by an administrator before they appear in the public library.
        </p>
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? 'Sending...' : 'Submit for review'}
        </Button>
      </div>
    </form>
  )
}