/**
 * Ingests real manual PDFs into the Doorlink manuals library.
 *
 * Run with: npx tsx scripts/ingest-manuals.ts
 *
 * Everything technical (page count, file size, body text) is read out of
 * the file itself. Everything editorial (title, manufacturer, what the
 * product actually is) comes from the manifest below, which was written
 * by reading the documents — not guessed from filenames. Nothing here
 * invents a specification: where a fact isn't in the document, the field
 * stays null.
 *
 * Text extraction needs `pdftotext` (poppler-utils) and `pdfinfo` on the
 * machine running the script. That's acceptable for an admin-side import
 * tool; it is never called from the running app.
 */
import { execFileSync } from 'child_process'
import { statSync } from 'fs'
import path from 'path'
import { DataSource, DocumentKind, DocumentOrigin, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface ManualManifestEntry {
  /** Storage key, relative to public/. */
  fileKey: string
  slug: string
  title: string
  description: string
  kind: DocumentKind
  origin: DocumentOrigin
  dataSource: DataSource
  language: string
  documentCode?: string
  revision?: string
  publisher?: string
  sourceUrl?: string
  provenanceNote?: string
  manufacturer: { name: string; slug: string }
  category: { name: string; slug: string }
  model?: { name: string; modelCode: string; slug: string; summary: string }
  /** Slug of the document this one supersedes, wired up after insert. */
  supersedesSlug?: string
}

const MANIFEST: ManualManifestEntry[] = [
  {
    fileKey: 'manuals/faac/faac-e045-732786-rev-b.pdf',
    slug: 'faac-e045-control-board-732786-rev-b',
    title: 'FAAC E045 control board — installation and programming manual (Rev. B)',
    description:
      'FAAC E045 control board manual, document 732786 revision B. Covers technical specifications, board layout, electrical connections, programming functions, BUS-2EASY device setup and radio code memorisation.',
    kind: DocumentKind.INSTALL_MANUAL,
    origin: DocumentOrigin.MANUFACTURER_ORIGINAL,
    // ADMIN_VERIFIED, not MANUFACTURER_VERIFIED: a Doorlink admin
    // confirmed this is the genuine FAAC file. FAAC did not supply it to
    // us, and saying they did would be a claim we can't back.
    dataSource: DataSource.ADMIN_VERIFIED,
    language: 'en',
    documentCode: '732786',
    revision: 'Rev. B',
    publisher: 'FAAC S.p.A.',
    manufacturer: { name: 'FAAC', slug: 'faac' },
    category: { name: 'Gate Control Boards', slug: 'gate-control-boards' },
    model: {
      name: 'E045 control board',
      modelCode: 'E045',
      slug: 'faac-e045',
      summary:
        'Control board for swing-leaf gates for vehicle and pedestrian transit, with an integrated 2-channel decoding system (DS, SLH/SLH LR, RC) and BUS-2EASY accessory support.',
    },
  },
  {
    fileKey: 'manuals/faac/faac-e045-732786-rev-c.pdf',
    slug: 'faac-e045-control-board-732786-rev-c',
    title: 'FAAC E045 control board — installation and programming manual (Rev. C)',
    description:
      'FAAC E045 control board manual, document 732786 revision C. The current revision held in the library; supersedes revision B.',
    kind: DocumentKind.INSTALL_MANUAL,
    origin: DocumentOrigin.MANUFACTURER_ORIGINAL,
    dataSource: DataSource.ADMIN_VERIFIED,
    language: 'en',
    documentCode: '732786',
    revision: 'Rev. C',
    publisher: 'FAAC S.p.A.',
    manufacturer: { name: 'FAAC', slug: 'faac' },
    category: { name: 'Gate Control Boards', slug: 'gate-control-boards' },
    model: {
      name: 'E045 control board',
      modelCode: 'E045',
      slug: 'faac-e045',
      summary:
        'Control board for swing-leaf gates for vehicle and pedestrian transit, with an integrated 2-channel decoding system (DS, SLH/SLH LR, RC) and BUS-2EASY accessory support.',
    },
    supersedesSlug: 'faac-e045-control-board-732786-rev-b',
  },
  {
    fileKey: 'manuals/bft/bft-qbo-wireless-keypad-coding.pdf',
    slug: 'bft-qbo-wireless-keypad-coding-guide',
    title: 'BFT Q.Bo wireless keypad — coding instructions',
    description:
      'Step-by-step coding instructions for the BFT Q.Bo wireless keypad: adding a code, changing the system password, and memorising the keypad on a control unit or receiver.',
    kind: DocumentKind.PROGRAMMING_GUIDE,
    // Not BFT's own PDF — this is a printed copy of a page published by
    // AGG Doors, a Melbourne garage door company. Useful, but it is a
    // third-party write-up and the library says so rather than passing
    // it off as a manufacturer document.
    origin: DocumentOrigin.THIRD_PARTY_GUIDE,
    dataSource: DataSource.COMMUNITY_SUBMITTED,
    language: 'en',
    publisher: 'AGG Doors',
    provenanceNote:
      'Captured from a web page published by AGG Doors (Melbourne), not from BFT. The instructions are theirs, not the manufacturer’s. BFT’s own documentation should be preferred where it is available.',
    manufacturer: { name: 'BFT', slug: 'bft' },
    category: { name: 'Access Control & Keypads', slug: 'access-control-keypads' },
    model: {
      name: 'Q.Bo wireless keypad',
      modelCode: 'Q.BO',
      slug: 'bft-q-bo-wireless-keypad',
      summary: 'Wireless entry keypad. Supports multiple stored codes across separate channels.',
    },
  },
]

function pdfPageCount(absolutePath: string): number | null {
  try {
    const out = execFileSync('pdfinfo', [absolutePath], { encoding: 'utf8' })
    const match = out.match(/^Pages:\s+(\d+)$/m)
    return match ? Number(match[1]) : null
  } catch {
    return null
  }
}

function pdfText(absolutePath: string): string | null {
  try {
    const out = execFileSync('pdftotext', [absolutePath, '-'], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    })
    // Collapse the whitespace that PDF extraction leaves behind so the
    // stored search text is a clean single-spaced body rather than a
    // column-shaped blob full of blank lines.
    return out.replace(/\s+/g, ' ').trim()
  } catch {
    return null
  }
}

async function main() {
  const publicDir = path.join(process.cwd(), 'public')

  for (const entry of MANIFEST) {
    const absolutePath = path.join(publicDir, entry.fileKey)
    const stat = statSync(absolutePath)
    const pageCount = pdfPageCount(absolutePath)
    const searchText = pdfText(absolutePath)

    if (!searchText) {
      console.warn(`  ! No text extracted from ${entry.fileKey} — it will not be full-text searchable.`)
    }

    const manufacturer = await prisma.manufacturer.upsert({
      where: { slug: entry.manufacturer.slug },
      update: {},
      create: {
        name: entry.manufacturer.name,
        slug: entry.manufacturer.slug,
        dataSource: DataSource.ADMIN_VERIFIED,
      },
    })

    const category = await prisma.category.upsert({
      where: { slug: entry.category.slug },
      update: {},
      create: { name: entry.category.name, slug: entry.category.slug },
    })

    let modelId: string | null = null
    if (entry.model) {
      const model = await prisma.model.upsert({
        where: { slug: entry.model.slug },
        update: {},
        create: {
          manufacturerId: manufacturer.id,
          categoryId: category.id,
          name: entry.model.name,
          modelCode: entry.model.modelCode,
          slug: entry.model.slug,
          summary: entry.model.summary,
          dataSource: DataSource.ADMIN_VERIFIED,
        },
      })
      modelId = model.id
    }

    const data = {
      title: entry.title,
      description: entry.description,
      kind: entry.kind,
      origin: entry.origin,
      dataSource: entry.dataSource,
      language: entry.language,
      documentCode: entry.documentCode ?? null,
      revision: entry.revision ?? null,
      publisher: entry.publisher ?? null,
      sourceUrl: entry.sourceUrl ?? null,
      provenanceNote: entry.provenanceNote ?? null,
      fileKey: entry.fileKey,
      originalFilename: path.basename(entry.fileKey),
      mimeType: 'application/pdf',
      fileSizeBytes: stat.size,
      pageCount,
      searchText,
      manufacturerId: manufacturer.id,
      categoryId: category.id,
      modelId,
      isPublished: true,
      publishedAt: new Date(),
    }

    const document = await prisma.document.upsert({
      where: { slug: entry.slug },
      update: data,
      create: { slug: entry.slug, ...data },
    })

    console.log(`  ✓ ${document.slug} (${pageCount ?? '?'}pp, ${(stat.size / 1024 / 1024).toFixed(1)}MB)`)
  }

  // Revision chains are wired in a second pass so the superseded
  // document is guaranteed to exist regardless of manifest order.
  for (const entry of MANIFEST) {
    if (!entry.supersedesSlug) continue
    const older = await prisma.document.findUnique({ where: { slug: entry.supersedesSlug } })
    if (!older) continue
    await prisma.document.update({
      where: { slug: entry.slug },
      data: { supersedesId: older.id },
    })
    console.log(`  ✓ ${entry.slug} supersedes ${entry.supersedesSlug}`)
  }

  const total = await prisma.document.count()
  console.log(`\nManuals library now holds ${total} documents.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
