'use client'

import { useMemo, useState } from 'react'
import { QuestionCard } from './QuestionCard'
import type { WizardAnswer, WizardSection } from './types'

/**
 * The walkthrough.
 *
 * Sections are collapsible and all rendered at once rather than paged:
 * a technician working down a shutter wants to jump back three
 * questions without losing their place, and paging turns that into
 * navigation. The sticky header keeps the asset and the progress on
 * screen the whole way down.
 */
export function Wizard({
  inspectionId,
  sections,
  answers,
  readOnly,
  storageUnavailable,
}: {
  inspectionId: string
  sections: WizardSection[]
  answers: Record<string, WizardAnswer>
  readOnly: boolean
  storageUnavailable: boolean
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const counts = useMemo(
    () =>
      sections.map((section) => ({
        id: section.id,
        answered: section.questions.filter((question) => {
          const answer = answers[question.code]
          if (!answer) return false
          return (
            answer.status !== null ||
            answer.valueText.length > 0 ||
            answer.valueChoices.length > 0 ||
            answer.evidenceCount > 0
          )
        }).length,
        total: section.questions.length,
      })),
    [sections, answers]
  )

  return (
    <div className="grid gap-4">
      {sections.map((section, index) => {
        const isCollapsed = collapsed[section.id] ?? false
        const count = counts[index]
        const done = count.total > 0 && count.answered === count.total

        return (
          <section key={section.id} className="rounded-md border border-line bg-rail/40">
            <button
              type="button"
              onClick={() => setCollapsed((prev) => ({ ...prev, [section.id]: !isCollapsed }))}
              aria-expanded={!isCollapsed}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-graphite">{section.title}</span>
                {section.description && !isCollapsed && (
                  <span className="mt-0.5 block text-micro text-zinc-deep">{section.description}</span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-2 text-micro">
                <span className={done ? 'text-good' : 'text-zinc-deep'}>
                  {count.answered}/{count.total}
                </span>
                <span aria-hidden className="text-zinc">
                  {isCollapsed ? '▸' : '▾'}
                </span>
              </span>
            </button>

            {!isCollapsed && (
              <ul className="grid gap-2 px-2 pb-2">
                {section.questions.map((question) => (
                  <QuestionCard
                    key={question.id}
                    inspectionId={inspectionId}
                    question={question}
                    initial={answers[question.code] ?? null}
                    readOnly={readOnly}
                    storageUnavailable={storageUnavailable}
                  />
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
