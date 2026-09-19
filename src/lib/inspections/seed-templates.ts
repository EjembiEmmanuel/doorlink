import 'server-only'

import type { Prisma, PrismaClient } from '@prisma/client'
import { DEFAULT_TEMPLATES, type SeedTemplate } from './templates'

// Installs the Doorlink-supplied templates as `organizationId: null`
// rows, available to every company.
//
// Idempotent by (organizationId, slug, version): running it twice does
// not duplicate a template, and it does not touch a template that is
// already installed. Publishing a *revised* version means bumping the
// version in `templates.ts` — the old rows stay exactly as they are,
// because an inspection carried out against version 1 must keep reading
// the questions version 1 actually asked (brief §32).

type Db = PrismaClient | Prisma.TransactionClient

async function installTemplate(db: Db, seed: SeedTemplate, version: number): Promise<boolean> {
  const existing = await db.inspectionTemplate.findFirst({
    where: { organizationId: null, slug: seed.slug, version },
    select: { id: true },
  })
  if (existing) return false

  await db.inspectionTemplate.create({
    data: {
      organizationId: null,
      slug: seed.slug,
      name: seed.name,
      description: seed.description,
      assetTypes: seed.assetTypes,
      version,
      publishedAt: new Date(),
      sections: {
        create: seed.sections.map((section, sectionIndex) => ({
          title: section.title,
          description: section.description ?? null,
          assetTypes: section.assetTypes ?? [],
          sortOrder: sectionIndex,
          questions: {
            create: section.questions.map((question, questionIndex) => ({
              code: question.code,
              prompt: question.prompt,
              helpText: question.helpText ?? null,
              type: question.type ?? 'PASS_FAIL_NA',
              required: question.required ?? true,
              options: question.options ?? [],
              unit: question.unit ?? null,
              requirePhoto: question.requirePhoto ?? false,
              recommendPhoto: question.recommendPhoto ?? false,
              showWhen: question.showWhen ?? undefined,
              sortOrder: questionIndex,
              rules: {
                create: (question.rules ?? []).map((rule) => ({
                  whenStatus: rule.whenStatus ?? null,
                  whenValue: rule.whenValue ?? null,
                  severity: rule.severity,
                  flag: true,
                  requireNote: rule.requireNote ?? false,
                  requirePhoto: rule.requirePhoto ?? false,
                  recommendation: rule.recommendation ?? null,
                  suggestedActionTitle: rule.suggestedActionTitle ?? null,
                })),
              },
            })),
          },
        })),
      },
    },
  })
  return true
}

export async function seedInspectionTemplates(db: Db, version = 1): Promise<number> {
  let installed = 0
  for (const seed of DEFAULT_TEMPLATES) {
    if (await installTemplate(db, seed, version)) installed += 1
  }
  return installed
}
