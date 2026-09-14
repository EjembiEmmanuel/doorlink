import type { DocumentKind, Prisma } from '@prisma/client'
import { prisma } from './prisma'

export interface ManualSearchParams {
  q?: string
  manufacturer?: string
  category?: string
  kind?: DocumentKind
  page?: number
}

export const MANUALS_PAGE_SIZE = 12

// Search runs across the document's own title, description, model code
// and the text extracted from the PDF at ingest. The body text is the
// point: a technician searching "BUS-2EASY" or "J11" is quoting a
// terminal label printed inside a manual, not a title anyone wrote.
//
// This is Postgres `contains` (ILIKE), not a tsvector index. That is a
// deliberate first cut: it is correct and needs no migration, and the
// library is small. It will need a real full-text index before the
// document count gets large — the swap is contained to this function.
function buildWhere(params: ManualSearchParams): Prisma.DocumentWhereInput {
  const filters: Prisma.DocumentWhereInput[] = [{ isPublished: true }]

  if (params.q?.trim()) {
    const q = params.q.trim()
    filters.push({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { documentCode: { contains: q, mode: 'insensitive' } },
        { searchText: { contains: q, mode: 'insensitive' } },
        { model: { is: { modelCode: { contains: q, mode: 'insensitive' } } } },
        { model: { is: { name: { contains: q, mode: 'insensitive' } } } },
        { manufacturer: { is: { name: { contains: q, mode: 'insensitive' } } } },
      ],
    })
  }

  if (params.manufacturer) filters.push({ manufacturer: { is: { slug: params.manufacturer } } })
  if (params.category) filters.push({ category: { is: { slug: params.category } } })
  if (params.kind) filters.push({ kind: params.kind })

  return { AND: filters }
}

export const manualListInclude = {
  manufacturer: { select: { name: true, slug: true } },
  category: { select: { name: true, slug: true } },
  model: { select: { name: true, modelCode: true, slug: true } },
} satisfies Prisma.DocumentInclude

export async function searchManuals(params: ManualSearchParams) {
  const page = Math.max(1, params.page ?? 1)
  const where = buildWhere(params)

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      include: manualListInclude,
      orderBy: [{ manufacturer: { name: 'asc' } }, { title: 'asc' }],
      skip: (page - 1) * MANUALS_PAGE_SIZE,
      take: MANUALS_PAGE_SIZE,
    }),
    prisma.document.count({ where }),
  ])

  return { documents, total, page, pageCount: Math.max(1, Math.ceil(total / MANUALS_PAGE_SIZE)) }
}

/**
 * Facets for the filter sidebar. Counts are scoped to published
 * documents only, so a filter never advertises results the list won't
 * show.
 */
export async function manualFacets() {
  const [manufacturers, categories, kinds] = await Promise.all([
    prisma.document.groupBy({
      by: ['manufacturerId'],
      where: { isPublished: true, manufacturerId: { not: null } },
      _count: true,
    }),
    prisma.document.groupBy({
      by: ['categoryId'],
      where: { isPublished: true, categoryId: { not: null } },
      _count: true,
    }),
    prisma.document.groupBy({ by: ['kind'], where: { isPublished: true }, _count: true }),
  ])

  const manufacturerIds = manufacturers.map((m) => m.manufacturerId!).filter(Boolean)
  const categoryIds = categories.map((c) => c.categoryId!).filter(Boolean)

  const [manufacturerRows, categoryRows] = await Promise.all([
    prisma.manufacturer.findMany({
      where: { id: { in: manufacturerIds } },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    }),
    prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, slug: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return {
    manufacturers: manufacturerRows.map((row) => ({
      ...row,
      count: manufacturers.find((m) => m.manufacturerId === row.id)?._count ?? 0,
    })),
    categories: categoryRows.map((row) => ({
      ...row,
      count: categories.find((c) => c.categoryId === row.id)?._count ?? 0,
    })),
    kinds: kinds
      .map((k) => ({ kind: k.kind, count: k._count }))
      .sort((a, b) => b.count - a.count),
  }
}

export function formatFileSize(bytes: number | null): string | null {
  if (bytes === null) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Pulls the few lines of body text around the first match, so a result
 * can show *why* it matched when the hit is on page 30 of a PDF rather
 * than in the title. Returns null when the query only matched metadata.
 */
export function extractSnippet(searchText: string | null, query: string | undefined, radius = 120): string | null {
  if (!searchText || !query?.trim()) return null
  const index = searchText.toLowerCase().indexOf(query.trim().toLowerCase())
  if (index === -1) return null

  const start = Math.max(0, index - radius)
  const end = Math.min(searchText.length, index + query.trim().length + radius)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < searchText.length ? '…' : ''
  return `${prefix}${searchText.slice(start, end).trim()}${suffix}`
}
