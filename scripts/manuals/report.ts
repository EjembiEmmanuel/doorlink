import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { reportFailure } from './db-guard'

// Generates manual_coverage_report.json from the database.
//
// Generated, never hand-written. A hand-maintained coverage number
// drifts from reality the first time someone adds a manufacturer and
// forgets to update it, and a stale statistic about how well-covered a
// library is is worse than no statistic.

const prisma = new PrismaClient()

async function main() {
  const [manufacturers, models, documents, altSources, aliases] = await Promise.all([
    prisma.manufacturer.findMany({
      select: {
        name: true,
        slug: true,
        country: true,
        dataSource: true,
        _count: { select: { models: true, documents: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.model.findMany({
      select: { id: true, dataSource: true, _count: { select: { documents: true } } },
    }),
    prisma.document.findMany({
      select: {
        dataSource: true,
        origin: true,
        verification: true,
        region: true,
        rights: true,
        kind: true,
        needsReview: true,
        fileKey: true,
        sourceUrl: true,
        category: { select: { name: true } },
      },
    }),
    prisma.documentSource.count(),
    prisma.modelAlias.count(),
  ])

  const count = <T extends string>(rows: { [k: string]: unknown }[], key: string) =>
    rows.reduce<Record<string, number>>((acc, row) => {
      const value = String(row[key] as T)
      acc[value] = (acc[value] ?? 0) + 1
      return acc
    }, {})

  // The seed catalogue ships three invented manufacturers for demo
  // purposes (Northgate, Veltrix, Harbrook). Counting those as manual
  // coverage would overstate the library with data that was never
  // meant to be real, so the headline figures exclude them and report
  // them separately.
  const isDemo = (row: { dataSource: string }) => row.dataSource === 'DEMO'
  const realDocuments = documents.filter((d) => !isDemo(d))
  const realModels = models.filter((m) => !isDemo(m))
  const realManufacturers = manufacturers.filter((m) => !isDemo(m))

  const official = realDocuments.filter((d) => d.origin === 'MANUFACTURER_ORIGINAL').length
  const thirdParty = realDocuments.filter((d) => d.origin === 'THIRD_PARTY_GUIDE').length
  const verified = realDocuments.filter(
    (d) => d.verification === 'REACHABLE' || d.verification === 'REDIRECTED'
  ).length

  const report = {
    generatedAt: new Date().toISOString(),

    // Stated up front so no one reads the totals as a claim of quality.
    caveat:
      'verified_documents counts links that were actually fetched and resolved. A document can be ' +
      'from an official manufacturer domain and still be unverified. Run `npm run manuals:verify` ' +
      'in an environment with outbound network access to raise this number. All figures below ' +
      'EXCLUDE the demo catalogue, whose manufacturers are invented for demonstration and are ' +
      'reported separately under demo_catalogue.',

    totals: {
      total_manufacturers: realManufacturers.length,
      total_models: realModels.length,
      total_documents: realDocuments.length,
      total_model_aliases: aliases,
      total_alternate_sources: altSources,
      official_documents: official,
      third_party_documents: thirdParty,
      verified_documents: verified,
      unverified_documents: realDocuments.length - verified,
      documents_needing_review: realDocuments.filter((d) => d.needsReview).length,
      // The gap that matters most for planning what to research next.
      models_without_documentation: realModels.filter((m) => m._count.documents === 0).length,
      link_only_documents: realDocuments.filter((d) => d.rights === 'LINK_ONLY').length,
      hosted_documents: realDocuments.filter((d) => d.fileKey !== null).length,
    },

    demo_catalogue: {
      note: 'Invented sample data shipped by prisma/seed.ts. Not real manufacturers or manuals.',
      manufacturers: manufacturers.filter(isDemo).length,
      models: models.filter(isDemo).length,
      documents: documents.filter(isDemo).length,
    },

    by_verification: count(realDocuments, 'verification'),
    by_origin: count(realDocuments, 'origin'),
    by_region: count(realDocuments, 'region'),
    by_document_kind: count(realDocuments, 'kind'),
    by_rights: count(realDocuments, 'rights'),

    by_manufacturer: realManufacturers.map((m) => ({
      name: m.name,
      slug: m.slug,
      country: m.country,
      models: m._count.models,
      documents: m._count.documents,
    })),
  }

  const path = join(process.cwd(), 'manual_coverage_report.json')
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`)

  console.log(`Wrote ${path}`)
  console.log(
    `  ${report.totals.total_manufacturers} manufacturers, ${report.totals.total_models} models, ` +
      `${report.totals.total_documents} documents`
  )
  console.log(
    `  ${report.totals.verified_documents} verified, ${report.totals.unverified_documents} unverified, ` +
      `${report.totals.models_without_documentation} model(s) with no documentation`
  )
}

main()
  .catch(reportFailure)
  .finally(() => prisma.$disconnect())
