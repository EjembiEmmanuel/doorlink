'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button, Field, Input, Select, Textarea } from '@/components/ui'
import { ACCEPTED_EXTENSIONS, MAX_FILE_BYTES } from '@/lib/manuals/submission-files'
import { submitManual, type SubmitState } from './actions'

function Submit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Uploading…' : 'Send for review'}
    </Button>
  )
}

export function SubmitForm({ categories }: { categories: Array<{ slug: string; name: string }> }) {
  const [state, action] = useActionState<SubmitState, FormData>(submitManual, {})

  if (state.ok) {
    return (
      <div className="rounded border border-line bg-paper p-6">
        <h2 className="text-lg font-semibold text-graphite">Thank you — it&apos;s with us</h2>
        <p className="mt-2 max-w-prose text-sm text-graphite-soft">
          Your reference is <strong className="font-mono">{state.reference}</strong>. Quote it if you need
          to ask about this upload.
        </p>
        <p className="mt-3 max-w-prose text-sm text-graphite-soft">
          It is not in the library yet. An automated check looks at the document first, and then a person
          reads it and decides. You&apos;ll get a notification either way — including if we need to ask you
          something.
        </p>
      </div>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-5" encType="multipart/form-data">
      {state.error ? (
        <p role="alert" className="rounded border border-alert/40 bg-alert/5 px-3 py-2 text-sm text-alert">
          {state.error}
        </p>
      ) : null}

      <Field label="Manufacturer or brand" htmlFor="manufacturerName">
        <Input id="manufacturerName" name="manufacturerName" required maxLength={120} autoComplete="off" />
      </Field>

      <Field label="Product name" htmlFor="productName" hint="What the unit is called — “Controll-A-Door 4”.">
        <Input id="productName" name="productName" required maxLength={160} autoComplete="off" />
      </Field>

      <Field
        label="Model number"
        htmlFor="modelCode"
        hint="Usually on a label on the motor or the first page of the manual."
      >
        <Input id="modelCode" name="modelCode" required maxLength={80} autoComplete="off" />
      </Field>

      <Field label="Type of equipment" htmlFor="categorySlug">
        <Select id="categorySlug" name="categorySlug" required defaultValue="">
          <option value="" disabled>
            Choose the closest one
          </option>
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
            </option>
          ))}
        </Select>
      </Field>

      {/* Everything below is optional on purpose — nobody should be
          blocked from contributing a manual because they cannot read a
          serial number off someone else's motor. */}
      <Field label="Serial number (optional)" htmlFor="serialNumber">
        <Input id="serialNumber" name="serialNumber" maxLength={120} autoComplete="off" />
      </Field>

      <Field label="Year (optional)" htmlFor="year" hint="Roughly when it was made or installed, if you know.">
        <Input id="year" name="year" inputMode="numeric" pattern="[0-9]*" maxLength={4} autoComplete="off" />
      </Field>

      <Field
        label="Anything else (optional)"
        htmlFor="description"
        hint="Where it came from, what it covers, anything a reviewer should know."
      >
        <Textarea id="description" name="description" maxLength={2000} />
      </Field>

      <Field
        label="The manual"
        htmlFor="file"
        hint={`${ACCEPTED_EXTENSIONS.join(', ')} — up to ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB.`}
      >
        <Input id="file" name="file" type="file" required accept={ACCEPTED_EXTENSIONS.join(',')} />
      </Field>

      <div>
        <Submit />
      </div>
    </form>
  )
}
