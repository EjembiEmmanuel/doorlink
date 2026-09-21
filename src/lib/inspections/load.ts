import 'server-only'

import { z } from 'zod'
import { prisma } from '../prisma'
import type { EngineAnswer, EngineTemplate, ShowWhen } from './types'

// Maps database rows into the engine's plain shapes. The one place the
// engine touches Prisma, so everything in `engine.ts` stays testable
// without a database.

// `showWhen` is a Json column, which means it is whatever was last
// written to it — including, after a bad template import, something that
// is not a condition at all. Parsing rather than casting means a
// malformed condition degrades to "always show this question", which is
// the safe direction: a technician sees one question too many instead of
// a safety question silently disappearing.
const showWhenSchema = z.object({
  questionCode: z.string().min(1),
  equals: z.array(z.string()).min(1),
})

export function parseShowWhen(value: unknown): ShowWhen | null {
  if (value === null || value === undefined) return null
  const parsed = showWhenSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

const TEMPLATE_INCLUDE = {
  sections: {
    orderBy: { sortOrder: 'asc' },
    include: {
      questions: {
        orderBy: { sortOrder: 'asc' },
        include: { rules: true },
      },
    },
  },
} as const

type TemplateRow = Awaited<
  ReturnType<typeof prisma.inspectionTemplate.findFirstOrThrow<{ include: typeof TEMPLATE_INCLUDE }>>
>

export function toEngineTemplate(row: TemplateRow): EngineTemplate {
  return {
    id: row.id,
    name: row.name,
    version: row.version,
    assetTypes: row.assetTypes,
    sections: row.sections.map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description,
      assetTypes: section.assetTypes,
      questions: section.questions.map((question) => ({
        id: question.id,
        code: question.code,
        prompt: question.prompt,
        helpText: question.helpText,
        type: question.type,
        required: question.required,
        options: question.options,
        unit: question.unit,
        requirePhoto: question.requirePhoto,
        recommendPhoto: question.recommendPhoto,
        showWhen: parseShowWhen(question.showWhen),
        rules: question.rules.map((rule) => ({
          id: rule.id,
          whenStatus: rule.whenStatus,
          whenValue: rule.whenValue,
          severity: rule.severity,
          flag: rule.flag,
          requireNote: rule.requireNote,
          requirePhoto: rule.requirePhoto,
          recommendation: rule.recommendation,
          suggestedActionTitle: rule.suggestedActionTitle,
        })),
      })),
    })),
  }
}

export async function loadTemplate(templateId: string): Promise<EngineTemplate | null> {
  const row = await prisma.inspectionTemplate.findUnique({
    where: { id: templateId },
    include: TEMPLATE_INCLUDE,
  })
  return row ? toEngineTemplate(row) : null
}

/**
 * Templates offered for an asset type: the company's own plus the
 * Doorlink-supplied ones, published only. A template with no asset types
 * is generic and always offered, which is what an asset recorded as
 * OTHER falls back to.
 */
export async function templatesForAsset(organizationId: string, assetType: string) {
  return prisma.inspectionTemplate.findMany({
    where: {
      archivedAt: null,
      publishedAt: { not: null },
      OR: [{ organizationId }, { organizationId: null }],
      // Prisma has no "array is empty OR contains" in one clause, so the
      // generic case is expressed as its own branch.
      AND: [
        {
          OR: [
            { assetTypes: { has: assetType as never } },
            { assetTypes: { isEmpty: true } },
          ],
        },
      ],
    },
    orderBy: [{ organizationId: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true, description: true, version: true, organizationId: true },
  })
}

type AnswerRow = {
  questionCode: string
  status: EngineAnswer['status']
  valueText: string | null
  valueNumber: number | null
  valueDate: Date | null
  valueChoices: string[]
  note: string | null
  _count?: { evidence: number }
  evidence?: unknown[]
}

export function toEngineAnswer(row: AnswerRow): EngineAnswer {
  return {
    questionCode: row.questionCode,
    status: row.status,
    valueText: row.valueText,
    valueNumber: row.valueNumber,
    valueDate: row.valueDate,
    valueChoices: row.valueChoices,
    note: row.note,
    // Counted from stored rows. An upload the technician started but
    // that never landed must not satisfy a photo requirement.
    evidenceCount: row._count?.evidence ?? row.evidence?.length ?? 0,
  }
}
