'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { InspectionStatus } from '@prisma/client'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Panel, PanelBody, PanelHeader } from '@/components/ui/Panel'
import type { OutstandingRequirement } from '@/lib/inspections/types'
import { reopenInspectionAction, submitInspectionAction, type InspectionActionState } from '../actions'

const EMPTY: InspectionActionState = {}

const REASON_LABELS: Record<OutstandingRequirement['reason'], string> = {
  unanswered: 'Unanswered',
  'note-required': 'Needs an explanation',
  'photo-required': 'Needs a photo',
}

/**
 * The review and sign-off step.
 *
 * What is still outstanding is listed by name and linked, rather than
 * the submit button simply being disabled: "you cannot finish" is not
 * useful to someone who does not know which of sixty questions is the
 * problem.
 */
export function SubmitPanel({
  inspectionId,
  outstanding,
  status,
  reportVersion,
}: {
  inspectionId: string
  outstanding: OutstandingRequirement[]
  status: InspectionStatus
  reportVersion: number | null
}) {
  const [submitState, submit, submitting] = useActionState(submitInspectionAction, EMPTY)
  const [reopenState, reopen, reopening] = useActionState(reopenInspectionAction, EMPTY)

  if (status === InspectionStatus.CANCELLED) {
    return (
      <Panel className="mt-6">
        <PanelBody>
          <p className="text-sm text-graphite-soft">This inspection was cancelled.</p>
        </PanelBody>
      </Panel>
    )
  }

  if (status === InspectionStatus.COMPLETED) {
    return (
      <Panel className="mt-6">
        <PanelHeader>
          <h2 className="font-medium text-graphite">
            Completed{reportVersion ? ` — report V${reportVersion}` : ''}
          </h2>
        </PanelHeader>
        <PanelBody className="grid gap-4">
          <Link href={`/inspections/${inspectionId}/report`} className="text-sm text-signal hover:underline">
            Open the report
          </Link>
          <form action={reopen} className="grid gap-3 border-t border-line pt-4">
            <input type="hidden" name="inspectionId" value={inspectionId} />
            <p className="text-sm text-graphite-soft">
              Reopening lets you correct the record. The issued report stays exactly as it is — resubmitting
              adds the next version beside it rather than editing what the customer already has.
            </p>
            {reopenState.error && (
              <p className="text-sm text-bad" role="alert">
                {reopenState.error}
              </p>
            )}
            <Field label="Why is this being reopened?" htmlFor="reason">
              <Input id="reason" name="reason" required placeholder="Corrected the serial number" />
            </Field>
            <Button type="submit" variant="secondary" disabled={reopening}>
              {reopening ? 'Reopening…' : 'Reopen for correction'}
            </Button>
          </form>
        </PanelBody>
      </Panel>
    )
  }

  const blocked = outstanding.length > 0

  return (
    <Panel className="mt-6">
      <PanelHeader>
        <h2 className="font-medium text-graphite">Finish and issue the report</h2>
      </PanelHeader>
      <PanelBody className="grid gap-4">
        {blocked && (
          <div className="rounded border border-caution/30 bg-caution-tint px-4 py-3">
            <p className="text-sm font-medium text-caution">
              {outstanding.length} item{outstanding.length === 1 ? '' : 's'} still to deal with
            </p>
            <ul className="mt-2 grid gap-1">
              {outstanding.slice(0, 12).map((item) => (
                <li key={`${item.questionCode}-${item.reason}`} className="text-sm">
                  <a href={`#q-${item.questionCode}`} className="text-signal hover:underline">
                    {item.prompt}
                  </a>
                  <span className="ml-2 text-micro text-graphite-soft">{REASON_LABELS[item.reason]}</span>
                </li>
              ))}
              {outstanding.length > 12 && (
                <li className="text-micro text-graphite-soft">
                  and {outstanding.length - 12} more.
                </li>
              )}
            </ul>
          </div>
        )}

        <form action={submit} className="grid gap-4">
          <input type="hidden" name="inspectionId" value={inspectionId} />

          {submitState.error && (
            <p className="rounded border border-bad/30 bg-bad/5 px-3 py-2 text-sm text-bad" role="alert">
              {submitState.error}
            </p>
          )}

          <Field label="Technician comments" htmlFor="notes" hint="Optional. Printed on the report.">
            <Textarea id="notes" name="notes" />
          </Field>

          <Field
            label="Customer acknowledgement"
            htmlFor="customerAckName"
            hint="Optional. The name of whoever on site acknowledged the inspection."
          >
            <Input id="customerAckName" name="customerAckName" />
          </Field>

          <label className="flex cursor-pointer items-start gap-3 rounded border border-line px-3 py-3 text-sm text-graphite has-[:checked]:border-signal has-[:checked]:bg-signal-tint">
            <input
              type="checkbox"
              name="reviewStatement"
              required
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#1B4FA8]"
            />
            <span>
              I have reviewed the inspection information and confirm that the information recorded
              accurately reflects the inspection performed.
            </span>
          </label>

          <Button type="submit" disabled={submitting || blocked}>
            {submitting ? 'Finishing…' : 'Complete inspection'}
          </Button>
          {blocked && (
            <p className="text-micro text-zinc-deep">
              Clear the items above first. The same check runs on the server, so nothing is signed off
              part-finished.
            </p>
          )}
        </form>
      </PanelBody>
    </Panel>
  )
}
