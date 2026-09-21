'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Field, Input } from '@/components/ui/Field'
import { MEASUREMENT_GUIDES, SAFETY_NOTICE } from '@/lib/spring-calculator/measuring'
import type { UnitSystem } from '@/lib/spring-calculator/units'

// Small building blocks for the calculator, kept out of the main
// component so that file stays about the flow rather than the markup.

/**
 * A large tappable choice.
 *
 * Deliberately a button, not a styled div: it is reachable by keyboard
 * and announced as a control, and the 44px floor is what makes it usable
 * with gloves on beside a door.
 */
export function ChoiceCard({
  title,
  description,
  selected,
  onSelect,
}: {
  title: string
  description?: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex min-h-[64px] w-full flex-col justify-center gap-1 rounded border px-4 py-3 text-left transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal',
        selected
          ? 'border-signal bg-signal-tint'
          : 'border-line bg-paper hover:border-signal hover:bg-signal-tint'
      )}
    >
      <span className="text-sm font-medium text-graphite">{title}</span>
      {description ? <span className="text-sm text-graphite-soft">{description}</span> : null}
    </button>
  )
}

/**
 * A numeric field with a unit suffix and an optional "how do I measure
 * this?" disclosure.
 *
 * inputMode="decimal" rather than type="number": it brings up the right
 * keyboard on a phone without the scroll-wheel and spinner behaviour
 * that makes type="number" awkward, and it does not silently discard a
 * value the browser considers malformed.
 */
export function MeasurementField({
  id,
  label,
  unit,
  value,
  onChange,
  guideId,
  hint,
  error,
  system,
}: {
  id: string
  label: string
  unit: string
  value: string
  onChange: (value: string) => void
  guideId?: keyof typeof MEASUREMENT_GUIDES
  hint?: string
  error?: string
  system: UnitSystem
}) {
  const [open, setOpen] = useState(false)
  const guide = guideId ? MEASUREMENT_GUIDES[guideId] : null

  return (
    <div className="flex flex-col gap-1">
      <Field label={label} htmlFor={id} hint={hint} error={error}>
        <div className="relative">
          <Input
            id={id}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
            className="h-12 pr-14 text-base"
            aria-describedby={guide ? `${id}-guide` : undefined}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-graphite-soft">
            {unit}
          </span>
        </div>
      </Field>

      {guide ? (
        <div>
          <button
            type="button"
            onClick={() => setOpen((previous) => !previous)}
            aria-expanded={open}
            className="min-h-[36px] text-sm text-signal underline underline-offset-2"
          >
            How do I measure this?
          </button>
          {open ? (
            <div
              id={`${id}-guide`}
              className="mt-2 rounded border border-line bg-rail p-3 text-sm"
            >
              <p className="font-medium text-graphite">{guide.title}</p>
              <p className="mt-1 text-graphite-soft">{guide.what}</p>
              <ol className="mt-2 flex list-decimal flex-col gap-1 pl-4 text-graphite-soft">
                {guide.how.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              {guide.example ? (
                <p className="mt-2 rounded border border-line bg-paper px-2 py-1 font-code text-micro text-graphite">
                  {guide.example[system]}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** The safety notice. Present on every step, never a blocking dialog. */
export function SafetyNotice() {
  return (
    <div className="rounded border border-caution/40 bg-caution/5 p-3">
      <p className="text-sm font-medium text-graphite">{SAFETY_NOTICE.title}</p>
      <p className="mt-1 text-sm text-graphite-soft">{SAFETY_NOTICE.body}</p>
    </div>
  )
}

/** Hidden by default. The ordinary user never opens it. */
export function Advanced({ children }: { children: ReactNode }) {
  return (
    <details className="rounded border border-line bg-paper">
      <summary className="min-h-[48px] cursor-pointer list-none px-4 py-3 text-sm font-medium text-graphite marker:hidden">
        Advanced measurements
      </summary>
      <div className="flex flex-col gap-4 border-t border-line px-4 py-4">{children}</div>
    </details>
  )
}

/** A single figure on the result screen. */
export function ResultStat({
  label,
  value,
  unit,
  primary = false,
}: {
  label: string
  value: string
  unit?: string
  primary?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded border p-4',
        primary ? 'border-signal bg-signal-tint' : 'border-line bg-paper'
      )}
    >
      <p className="text-micro uppercase tracking-wide text-graphite-soft">{label}</p>
      <p
        className={cn(
          'mt-1 font-code text-graphite',
          primary ? 'text-3xl' : 'text-xl'
        )}
      >
        {value}
        {unit ? <span className="ml-1 text-sm text-graphite-soft">{unit}</span> : null}
      </p>
    </div>
  )
}

export function StepHeading({ step, total, title }: { step: number; total: number; title: string }) {
  return (
    <div>
      <p className="text-micro uppercase tracking-wide text-graphite-soft">
        Step {step} of {total}
      </p>
      <h2 className="mt-1 text-lg font-semibold text-graphite">{title}</h2>
    </div>
  )
}
