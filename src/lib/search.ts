import 'server-only'

import { ListingCondition, ListingStatus, type Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { isDatabaseUnreachable } from './db-errors'
import { formatMoney } from './money'

const CONDITION_LABELS: Record<ListingCondition, string> = {
  NEW: 'New',
  REFURBISHED: 'Refurbished',
  USED: 'Used',
}

/**
 * Search across everything in Doorlink.
 *
 * Two decisions shape this module.
 *
 * **Results are grouped by type, not interleaved.** Ranking a manual
 * against a technician against a part requires a relevance model that
 * does not exist here, and inventing one would mean the order on screen
 * implies a judgement nothing actually made. Within each group the order
 * comes from a real signal — a technician's review count, a document's
 * revision, a listing's price — and the groups themselves are ordered by
 * how often people search for that kind of thing.
 *
 * **It is Postgres ILIKE, like the manuals search it sits beside.** That
 * is a deliberate first cut: correct, no migration, and the catalogue is
 * small. It will want a real full-text index before it gets large; the
 * swap is contained to this file.
 */

export type SearchKind = 'manual' | 'product' | 'technician' | 'service' | 'part' | 'manufacturer'

export const SEARCH_KINDS: SearchKind[] = ['manual', 'product', 'technician', 'service', 'part', 'manufacturer']

export const SEARCH_KIND_LABELS: Record<SearchKind, string> = {
  manual: 'Manuals',
  product: 'Products',
  technician: 'Technicians',
  service: 'Services',
  part: 'Parts for sale',
  manufacturer: 'Manufacturers',
}

export interface SearchHit {
  kind: SearchKind
  id: string
  title: string
  /** One line of context — what this is, not a description of it. */
  subtitle: string | null
  href: string
  /** Shown as a small badge. Absent when there is nothing true to say. */
  tag?: string | null
}

export interface SearchGroup {
  kind: SearchKind
  hits: SearchHit[]
  /** Total matches, which can exceed `hits.length`. */
  total: number
}

export interface SearchResults {
  query: string
  groups: SearchGroup[]
  total: number
  /** False when the database could not be reached. */
  available: boolean
}

/** How many of each kind to show on the combined page. */
const PER_KIND = 5

const contains = (q: string) => ({ contains: q, mode: 'insensitive' as const })

/**
 * The minimum length worth running six queries for. One or two
 * characters matches most of the catalogue, which is not a search
 * result, it is a list.
 */
export const MIN_QUERY_LENGTH = 2

export async function search(rawQuery: string, kinds: SearchKind[] = SEARCH_KINDS): Promise<SearchResults> {
  const query = rawQuery.trim()
  if (query.length < MIN_QUERY_LENGTH) {
    return { query, groups: [], total: 0, available: true }
  }

  const wanted = new Set(kinds)

  try {
    const [manuals, products, technicians, services, parts, manufacturers] = await Promise.all([
      wanted.has('manual') ? searchManualsFor(query) : emptyGroup('manual'),
      wanted.has('product') ? searchProducts(query) : emptyGroup('product'),
      wanted.has('technician') ? searchTechnicians(query) : emptyGroup('technician'),
      wanted.has('service') ? searchServices(query) : emptyGroup('service'),
      wanted.has('part') ? searchParts(query) : emptyGroup('part'),
      wanted.has('manufacturer') ? searchManufacturers(query) : emptyGroup('manufacturer'),
    ])

    const groups = [manuals, products, technicians, services, parts, manufacturers].filter(
      (group) => group.hits.length > 0
    )

    return {
      query,
      groups,
      total: groups.reduce((sum, group) => sum + group.total, 0),
      available: true,
    }
  } catch (error) {
    if (!isDatabaseUnreachable(error)) throw error
    return { query, groups: [], total: 0, available: false }
  }
}

async function emptyGroup(kind: SearchKind): Promise<SearchGroup> {
  return { kind, hits: [], total: 0 }
}

// ---------------------------------------------------------------------

async function searchManualsFor(q: string): Promise<SearchGroup> {
  // Same fields as the manuals page, including the text extracted from
  // the PDF: someone searching a terminal label printed inside a manual
  // is the case this exists for.
  const where: Prisma.DocumentWhereInput = {
    isPublished: true,
    OR: [
      { title: contains(q) },
      { description: contains(q) },
      { documentCode: contains(q) },
      { searchText: contains(q) },
      { model: { is: { modelCode: contains(q) } } },
      { manufacturer: { is: { name: contains(q) } } },
    ],
  }

  const [rows, total] = await Promise.all([
    prisma.document.findMany({
      where,
      take: PER_KIND,
      orderBy: [{ publishedAt: 'desc' }, { title: 'asc' }],
      include: {
        manufacturer: { select: { name: true } },
        model: { select: { modelCode: true } },
      },
    }),
    prisma.document.count({ where }),
  ])

  return {
    kind: 'manual',
    total,
    hits: rows.map((doc) => ({
      kind: 'manual' as const,
      id: doc.id,
      title: doc.title,
      subtitle: [doc.manufacturer?.name, doc.model?.modelCode].filter(Boolean).join(' · ') || null,
      href: `/manuals/${doc.slug}`,
      tag: doc.documentCode,
    })),
  }
}

async function searchProducts(q: string): Promise<SearchGroup> {
  const where: Prisma.ModelWhereInput = {
    OR: [
      { modelCode: contains(q) },
      { name: contains(q) },
      { summary: contains(q) },
      { manufacturer: { is: { name: contains(q) } } },
    ],
  }

  const [rows, total] = await Promise.all([
    prisma.model.findMany({
      where,
      take: PER_KIND,
      orderBy: { name: 'asc' },
      include: {
        manufacturer: { select: { name: true } },
        category: { select: { name: true } },
        _count: { select: { documents: true } },
      },
    }),
    prisma.model.count({ where }),
  ])

  return {
    kind: 'product',
    total,
    hits: rows.map((model) => ({
      kind: 'product' as const,
      id: model.id,
      title: `${model.modelCode} — ${model.name}`,
      subtitle: [model.manufacturer?.name, model.category?.name].filter(Boolean).join(' · ') || null,
      href: `/model/${model.id}`,
      tag:
        model._count.documents > 0
          ? `${model._count.documents} ${model._count.documents === 1 ? 'document' : 'documents'}`
          : null,
    })),
  }
}

async function searchTechnicians(q: string): Promise<SearchGroup> {
  // Only profiles a person has actually filled in, and only what is
  // already public on their profile page. No contact details are read
  // here — search must not become the way around Doorlink withholding
  // them until a job is agreed.
  const where: Prisma.TechnicianProfileWhereInput = {
    OR: [
      { businessName: contains(q) },
      { headline: contains(q) },
      { bio: contains(q) },
      { baseSuburb: contains(q) },
      { user: { is: { name: contains(q) } } },
      { services: { some: { category: { is: { name: contains(q) } } } } },
      { serviceAreas: { some: { OR: [{ suburb: contains(q) }, { postcode: contains(q) }] } } },
    ],
  }

  const [rows, total] = await Promise.all([
    prisma.technicianProfile.findMany({
      where,
      take: PER_KIND,
      // Reviewed technicians first, then by rating. Someone with three
      // reviews at 4.7 is a more useful result than someone with one at
      // 5.0, and someone with none has nothing to rank on at all.
      orderBy: [{ ratingCount: 'desc' }, { ratingAvg: 'desc' }, { jobsCompleted: 'desc' }],
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.technicianProfile.count({ where }),
  ])

  return {
    kind: 'technician',
    total,
    hits: rows.map((profile) => ({
      kind: 'technician' as const,
      id: profile.id,
      title: profile.businessName || profile.user.name,
      subtitle: profile.headline || [profile.baseSuburb, profile.baseState].filter(Boolean).join(' ') || null,
      href: `/technicians/${profile.user.id}`,
      // An absent rating is stated as absent rather than shown as a
      // zero, which reads as a bad score instead of no score.
      tag:
        profile.ratingCount > 0
          ? `${profile.ratingAvg?.toFixed(1)} ★ · ${profile.ratingCount}`
          : 'No reviews yet',
    })),
  }
}

async function searchServices(q: string): Promise<SearchGroup> {
  const where: Prisma.ServiceCategoryWhereInput = {
    isActive: true,
    OR: [{ name: contains(q) }, { description: contains(q) }],
  }

  const [rows, total] = await Promise.all([
    prisma.serviceCategory.findMany({
      where,
      take: PER_KIND,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.serviceCategory.count({ where }),
  ])

  return {
    kind: 'service',
    total,
    hits: rows.map((category) => ({
      kind: 'service' as const,
      id: category.id,
      title: category.name,
      subtitle: category.description,
      // Straight into posting a job for that service, which is what
      // someone searching a service name is trying to do.
      href: `/request-technician?service=${encodeURIComponent(category.slug)}`,
      tag: 'Get quotes',
    })),
  }
}

async function searchParts(q: string): Promise<SearchGroup> {
  // A Listing has no description column — the title and the model it
  // fits are the whole of its searchable text.
  const where: Prisma.ListingWhereInput = {
    status: ListingStatus.ACTIVE,
    OR: [
      { title: contains(q) },
      { model: { is: { modelCode: contains(q) } } },
      { model: { is: { name: contains(q) } } },
    ],
  }

  const [rows, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      take: PER_KIND,
      orderBy: { createdAt: 'desc' },
      include: { model: { select: { modelCode: true } } },
    }),
    prisma.listing.count({ where }),
  ])

  return {
    kind: 'part',
    total,
    hits: rows.map((listing) => ({
      kind: 'part' as const,
      id: listing.id,
      title: listing.title,
      subtitle: [listing.model.modelCode, CONDITION_LABELS[listing.condition]].filter(Boolean).join(' · '),
      href: `/marketplace?q=${encodeURIComponent(listing.title)}`,
      tag: formatMoney(listing.priceCents, listing.currency),
    })),
  }
}

async function searchManufacturers(q: string): Promise<SearchGroup> {
  const where: Prisma.ManufacturerWhereInput = { name: contains(q) }

  const [rows, total] = await Promise.all([
    prisma.manufacturer.findMany({
      where,
      take: PER_KIND,
      orderBy: { name: 'asc' },
      include: { _count: { select: { models: true, documents: true } } },
    }),
    prisma.manufacturer.count({ where }),
  ])

  return {
    kind: 'manufacturer',
    total,
    hits: rows.map((manufacturer) => ({
      kind: 'manufacturer' as const,
      id: manufacturer.id,
      title: manufacturer.name,
      subtitle: `${manufacturer._count.models} ${manufacturer._count.models === 1 ? 'product' : 'products'} · ${manufacturer._count.documents} ${manufacturer._count.documents === 1 ? 'document' : 'documents'}`,
      href: `/manuals?manufacturer=${manufacturer.slug}`,
      tag: null,
    })),
  }
}
