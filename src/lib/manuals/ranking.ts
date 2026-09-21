import { DocumentOrigin, Region, VerificationState } from '@prisma/client'
import { matchModel, normaliseModel, type ModelMatch } from './normalise'

// Result ordering for the manual finder.
//
// The order in brief §16 is a statement about what a person searching
// "Merlin MT60" actually wants: that exact model's documents first, not
// every Merlin product. Everything below implements that, plus two
// things the brief implies rather than lists — a confirmed official
// document outranks an unverified mirror of the same thing, and an
// Australian document outranks an overseas one when the reader is in
// Australia, because the wiring differs.
//
// Pure functions over plain data, so the ordering can be tested without
// a database and without guessing at Postgres collation.

export interface RankableDocument {
  id: string
  title: string
  kind: string
  modelCode: string | null
  modelName: string | null
  manufacturerName: string | null
  categoryName: string | null
  /** Alias spellings already normalised, from ModelAlias. */
  aliasNormalised: string[]
  origin: DocumentOrigin
  verification: VerificationState
  region: Region
  searchText: string | null
}

export interface RankingContext {
  query: string
  /** The reader's market. Australian documents are preferred for AU. */
  preferRegion?: Region
}

export interface RankedDocument<T> {
  document: T
  score: number
  /** Why it matched, so the UI can say so instead of presenting a bare list. */
  reason: MatchReason
  modelMatch: ModelMatch
}

export type MatchReason =
  | 'exact-model'
  | 'model-alias'
  | 'partial-model'
  | 'manufacturer'
  | 'category'
  | 'title'
  | 'document-text'

// Tiers are far enough apart that no combination of lower-tier bonuses
// can lift a result above a higher tier. An exact model match must never
// be displaced by a keyword hit that happens to also be official and
// Australian.
const TIER = {
  exactModel: 10_000,
  aliasModel: 8_000,
  partialModel: 6_000,
  manufacturer: 4_000,
  category: 2_000,
  title: 1_000,
  body: 500,
} as const

// Bonuses only ever reorder within a tier.
const OFFICIAL_BONUS = 120
const VERIFIED_BONUS = 60
const REGION_BONUS = 90

function provenanceBonus(doc: RankableDocument): number {
  let bonus = 0
  if (doc.origin === DocumentOrigin.MANUFACTURER_ORIGINAL) bonus += OFFICIAL_BONUS
  if (
    doc.verification === VerificationState.REACHABLE ||
    doc.verification === VerificationState.REDIRECTED
  ) {
    bonus += VERIFIED_BONUS
  }
  return bonus
}

function regionBonus(doc: RankableDocument, prefer: Region | undefined): number {
  if (!prefer || prefer === Region.UNKNOWN) return 0
  if (doc.region === prefer) return REGION_BONUS
  // A global document is fine anywhere; an overseas-specific one is not
  // penalised into oblivion, just not preferred.
  if (doc.region === Region.GLOBAL) return Math.round(REGION_BONUS / 2)
  return 0
}

function includesInsensitive(haystack: string | null, needle: string): boolean {
  return Boolean(haystack && haystack.toLowerCase().includes(needle))
}

/**
 * Score one document against a query. Returns null when nothing matched,
 * so a caller can drop it rather than show a zero-relevance row.
 */
export function scoreDocument(
  doc: RankableDocument,
  context: RankingContext
): { score: number; reason: MatchReason; modelMatch: ModelMatch } | null {
  const query = context.query.trim()
  if (query.length === 0) return null

  const lower = query.toLowerCase()
  const normalisedQuery = normaliseModel(query)
  const bonus = provenanceBonus(doc) + regionBonus(doc, context.preferRegion)

  const modelMatch: ModelMatch = doc.modelCode ? matchModel(query, doc.modelCode) : 'none'

  if (modelMatch === 'exact' || modelMatch === 'normalised') {
    return { score: TIER.exactModel + bonus, reason: 'exact-model', modelMatch }
  }

  // An alias is the manufacturer's or a distributor's own alternate
  // spelling, so it is nearly as good as the printed code.
  if (normalisedQuery.length > 0 && doc.aliasNormalised.includes(normalisedQuery)) {
    return { score: TIER.aliasModel + bonus, reason: 'model-alias', modelMatch: 'normalised' }
  }

  if (modelMatch === 'prefix' || modelMatch === 'contains') {
    const penalty = modelMatch === 'prefix' ? 0 : 200
    return { score: TIER.partialModel - penalty + bonus, reason: 'partial-model', modelMatch }
  }

  if (includesInsensitive(doc.manufacturerName, lower)) {
    return { score: TIER.manufacturer + bonus, reason: 'manufacturer', modelMatch }
  }

  if (includesInsensitive(doc.categoryName, lower)) {
    return { score: TIER.category + bonus, reason: 'category', modelMatch }
  }

  if (includesInsensitive(doc.title, lower) || includesInsensitive(doc.modelName, lower)) {
    return { score: TIER.title + bonus, reason: 'title', modelMatch }
  }

  // Last: the text inside the document. This is what makes "error code
  // 5" or "BUS-2EASY" findable at all, but a body hit is the weakest
  // signal of the set.
  if (includesInsensitive(doc.searchText, lower)) {
    return { score: TIER.body + bonus, reason: 'document-text', modelMatch }
  }

  return null
}

export function rankDocuments<T extends RankableDocument>(
  documents: readonly T[],
  context: RankingContext
): RankedDocument<T>[] {
  return documents
    .map((document) => {
      const scored = scoreDocument(document, context)
      return scored ? { document, ...scored } : null
    })
    .filter((entry): entry is RankedDocument<T> => entry !== null)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      // Stable, explicable tiebreak rather than whatever order the rows
      // arrived in.
      return a.document.title.localeCompare(b.document.title)
    })
}

export const MATCH_REASON_LABELS: Record<MatchReason, string> = {
  'exact-model': 'Exact model match',
  'model-alias': 'Known alternate spelling',
  'partial-model': 'Similar model number',
  manufacturer: 'Manufacturer match',
  category: 'Product category',
  title: 'Document title',
  'document-text': 'Found inside the document',
}
