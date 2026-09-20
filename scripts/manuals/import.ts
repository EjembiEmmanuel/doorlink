import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient, DataSource } from '@prisma/client'
import { manufacturerFileSchema } from './schema'
import { aliasSpellings, normaliseModel } from '../../src/lib/manuals/normalise'

// Imports data/manuals/*.json into the catalogue.
//
// Idempotent by natural key — manufacturer slug, then (manufacturer,
// modelCode), then (model, sourceUrl). Re-running updates in place
// rather than duplicating, so the seed files stay the source of truth
// and a corrected URL is one edit plus one re-run.
//
// It never marks anything verified. Verification is a separate step
// that has to actually fetch the URL (see verify.ts), and conflating
// the two is how an unchecked link starts looking official.

const prisma = new PrismaClient()
const DATA_DIR = join(process.cwd(), 'data', 'manuals')

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function main() {
  // portals.json shares this directory but is a registry of harvest
  // targets, not a seed file. Letting it fall through printed a
  // "not valid" warning on every run, which is exactly the warning a
  // genuinely malformed seed file needs to stand out with.
  const NOT_SEED_FILES = new Set(['portals.json'])
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json') && !NOT_SEED_FILES.has(f))
  if (files.length === 0) {
    console.log('No seed files in data/manuals — nothing to import.')
    return
  }

  let manufacturers = 0
  let models = 0
  let documents = 0
  let aliases = 0
  let altSources = 0
  const gaps: string[] = []

  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8'))
    const parsed = manufacturerFileSchema.safeParse(raw)
    if (!parsed.success) {
      // Loud and specific. A silently skipped file is a manufacturer
      // that quietly never appears in search.
      console.error(`\n${file} is not valid:`)
      for (const issue of parsed.error.issues) {
        console.error(`  ${issue.path.join('.')}: ${issue.message}`)
      }
      process.exitCode = 1
      continue
    }

    const { manufacturer, models: modelSeeds } = parsed.data

    const mfr = await prisma.manufacturer.upsert({
      where: { slug: manufacturer.slug },
      update: {
        country: manufacturer.country ?? null,
        website: manufacturer.website ?? null,
        supportUrl: manufacturer.supportUrl ?? null,
      },
      create: {
        name: manufacturer.name,
        slug: manufacturer.slug,
        country: manufacturer.country ?? null,
        website: manufacturer.website ?? null,
        supportUrl: manufacturer.supportUrl ?? null,
        // IMPORTED, not ADMIN_VERIFIED: nobody has checked these by hand.
        dataSource: DataSource.IMPORTED,
      },
    })
    manufacturers += 1

    for (const seed of modelSeeds) {
      const category = await prisma.category.upsert({
        where: { slug: seed.category },
        update: {},
        create: {
          slug: seed.category,
          name: seed.category.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        },
      })

      const model = await prisma.model.upsert({
        where: { manufacturerId_modelCode: { manufacturerId: mfr.id, modelCode: seed.modelCode } },
        update: { name: seed.name, categoryId: category.id },
        create: {
          manufacturerId: mfr.id,
          categoryId: category.id,
          name: seed.name,
          modelCode: seed.modelCode,
          slug: slugify(`${manufacturer.slug}-${seed.modelCode}`),
          dataSource: DataSource.IMPORTED,
        },
      })
      models += 1

      if (seed.documents.length === 0) {
        gaps.push(`${manufacturer.name} ${seed.modelCode} — ${seed.note ?? 'no documentation located'}`)
      }

      // Aliases: the spellings generated from the code, plus any the
      // seed file states explicitly.
      const wanted = new Set([...aliasSpellings(seed.modelCode), ...seed.aliases])
      for (const alias of wanted) {
        const normalised = normaliseModel(alias)
        if (!normalised) continue
        await prisma.modelAlias.upsert({
          where: { modelId_normalised: { modelId: model.id, normalised } },
          update: { alias },
          create: { modelId: model.id, alias, normalised, source: 'seed' },
        })
        aliases += 1
      }

      for (const doc of seed.documents) {
        const existing = await prisma.document.findFirst({
          where: { modelId: model.id, sourceUrl: doc.sourceUrl },
          select: { id: true },
        })

        const data = {
          manufacturerId: mfr.id,
          categoryId: category.id,
          kind: doc.kind,
          title: doc.title,
          description: doc.description ?? null,
          sourceUrl: doc.sourceUrl,
          origin: doc.origin,
          publisher: doc.publisher ?? null,
          region: doc.region,
          rights: doc.rights,
          rightsNote: doc.rightsNote ?? null,
          language: doc.language,
          documentCode: doc.documentCode ?? null,
          revision: doc.revision ?? null,
          provenanceNote: doc.evidence,
          dataSource: DataSource.IMPORTED,
        }

        const record = existing
          ? await prisma.document.update({ where: { id: existing.id }, data })
          : await prisma.document.create({
              data: {
                ...data,
                modelId: model.id,
                slug: slugify(`${manufacturer.slug}-${seed.modelCode}-${doc.kind}-${doc.title}`).slice(0, 90),
                ...(doc.version ? { version: doc.version } : {}),
              },
            })
        documents += 1

        for (const alt of doc.altSources) {
          await prisma.documentSource.upsert({
            where: { documentId_url: { documentId: record.id, url: alt.url } },
            update: { authority: alt.authority, label: alt.label ?? null },
            create: {
              documentId: record.id,
              url: alt.url,
              authority: alt.authority,
              label: alt.label ?? null,
            },
          })
          altSources += 1
        }
      }
    }
  }

  console.log(
    `\nImported ${manufacturers} manufacturers, ${models} models, ${documents} documents, ` +
      `${aliases} aliases, ${altSources} alternate sources.`
  )
  console.log('Every document is UNVERIFIED. Run `npm run manuals:verify` where the network allows.')

  if (gaps.length > 0) {
    console.log(`\n${gaps.length} model(s) recorded with no documentation:`)
    for (const gap of gaps) console.log(`  ${gap}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
