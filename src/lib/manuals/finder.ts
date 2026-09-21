import 'server-only'

import { Region } from '@prisma/client'
import { prisma } from '../prisma'
import { normaliseModel } from './normalise'
import { rankDocuments, type RankableDocument, type RankedDocument } from './ranking'

// The query side of the manual finder.
//
// Ranking happens in `ranking.ts` on plain objects rather than in SQL.
// That costs a wider fetch, but it makes the ordering — which is the
// part a technician will judge the feature by — testable without a
// database, and it keeps "why did this rank here" answerable.
//
// The candidate set is narrowed in SQL first so the wider fetch stays
// small. If the library grows past what this comfortably handles, the
// narrowing gets a full-text index and the ranking is untouched.

export interface FinderQuery {
  q?: string
  manufacturerSlug?: string
  categorySlug?: string
  kind?: string
  region?: Region
}

const DOC_SELECT = {
  id: true,
  slug: true,
  title: true,
  kind: true,
  description: true,
  sourceUrl: true,
  fileKey: true,
  origin: true,
  publisher: true,
  region: true,
  rights: true,
  verification: true,
  lastVerifiedAt: true,
  needsReview: true,
  language: true,
  pageCount: true,
  searchText: true,
  provenanceNote: true,
  manufacturer: { select: { name: true, slug: true, website: true, supportUrl: true } },
  category: { select: { name: true, slug: true } },
  model: {
    select: {
      name: true,
      modelCode: true,
      slug: true,
      aliases: { select: { normalised: true } },
    },
  },
  altSources: { select: { url: true, authority: true, label: true } },
} as const

export type FinderDocument = Awaited<
  ReturnType<typeof prisma.document.findFirstOrThrow<{ select: typeof DOC_SELECT }>>
>

function toRankable(doc: FinderDocument): RankableDocument & { id: string } {
  return {
    id: doc.id,
    title: doc.title,
    kind: doc.kind,
    modelCode: doc.model?.modelCode ?? null,
    modelName: doc.model?.name ?? null,
    manufacturerName: doc.manufacturer?.name ?? null,
    categoryName: doc.category?.name ?? null,
    aliasNormalised: doc.model?.aliases.map((a) => a.normalised) ?? [],
    origin: doc.origin,
    verification: doc.verification,
    region: doc.region,
    searchText: doc.searchText,
  }
}

/**
 * Find documents for a query.
 *
 * Returns ranked results plus the raw rows, so a page can render the
 * document and say why it matched in the same pass.
 */
export async function findManuals(
  query: FinderQuery,
  limit = 40
): Promise<{ results: RankedDocument<RankableDocument & { id: string }>[]; byId: Map<string, FinderDocument> }> {
  const q = query.q?.trim() ?? ''
  const normalised = normaliseModel(q)

  const filters: Record<string, unknown>[] = [{ isPublished: true }]
  if (query.manufacturerSlug) filters.push({ manufacturer: { is: { slug: query.manufacturerSlug } } })
  if (query.categorySlug) filters.push({ category: { is: { slug: query.categorySlug } } })
  if (query.kind) filters.push({ kind: query.kind })

  if (q) {
    filters.push({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { documentCode: { contains: q, mode: 'insensitive' } },
        { searchText: { contains: q, mode: 'insensitive' } },
        { manufacturer: { is: { name: { contains: q, mode: 'insensitive' } } } },
        { category: { is: { name: { contains: q, mode: 'insensitive' } } } },
        { model: { is: { name: { contains: q, mode: 'insensitive' } } } },
        { model: { is: { modelCode: { contains: q, mode: 'insensitive' } } } },
        // The alias join is what makes "mt-60" find MT60 at all.
        ...(normalised ? [{ model: { is: { aliases: { some: { normalised } } } } }] : []),
      ],
    })
  }

  const rows = await prisma.document.findMany({
    where: { AND: filters } as never,
    select: DOC_SELECT,
    take: 200,
  })

  const byId = new Map(rows.map((row) => [row.id, row]))

  // With no query there is nothing to rank against, so fall back to a
  // stable alphabetical listing rather than an arbitrary one.
  if (!q) {
    const listed = rows
      .slice(0, limit)
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((row) => ({
        document: toRankable(row),
        score: 0,
        reason: 'title' as const,
        modelMatch: 'none' as const,
      }))
    return { results: listed, byId }
  }

  const ranked = rankDocuments(rows.map(toRankable), {
    query: q,
    preferRegion: query.region ?? Region.AU,
  })

  return { results: ranked.slice(0, limit), byId }
}

/** Manufacturers that actually have documents, for the guided picker. */
export async function manufacturersWithManuals(categorySlug?: string) {
  return prisma.manufacturer.findMany({
    where: {
      documents: {
        some: { isPublished: true, ...(categorySlug ? { category: { is: { slug: categorySlug } } } : {}) },
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      country: true,
      _count: { select: { documents: true } },
    },
    orderBy: [{ country: 'asc' }, { name: 'asc' }],
  })
}

/** Models for one manufacturer, including those with no documentation yet. */
export async function modelsForManufacturer(manufacturerSlug: string) {
  return prisma.model.findMany({
    where: { manufacturer: { is: { slug: manufacturerSlug } } },
    select: {
      id: true,
      name: true,
      modelCode: true,
      slug: true,
      category: { select: { name: true, slug: true } },
      _count: { select: { documents: true } },
    },
    orderBy: { modelCode: 'asc' },
  })
}

export async function manualCategories() {
  return prisma.category.findMany({
    where: { documents: { some: { isPublished: true } } },
    select: { id: true, name: true, slug: true, _count: { select: { documents: true } } },
    orderBy: { name: 'asc' },
  })
}
