import { createHash } from 'node:crypto'

/**
 * URL slugs for catalogue records.
 *
 * These end up in public paths — a document's slug is the `[slug]`
 * segment under /manuals — so two properties matter beyond readability:
 * they must be unique, and they must be the same every time the
 * importer runs. A slug that moves on a re-import breaks a link that
 * worked yesterday.
 */

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** How much of the readable part survives before the digest. */
const READABLE_LENGTH = 80

/**
 * A document's slug: readable stem, then a short digest of its source
 * URL.
 *
 * The stem alone is not enough. It was, until Steel-Line's SD800 turned
 * up with several editions of one manual whose titles differ only in a
 * trailing version — past the cut, so the stem discarded the one thing
 * telling them apart and the second insert hit the unique index. Any
 * model with more than one edition of a document would have done it;
 * the SD800 just got there first.
 *
 * The digest is taken from `sourceUrl` because that is already the
 * natural key documents are matched on when re-importing. Same URL,
 * same slug, every run.
 */
export function documentSlug(readable: string, sourceUrl: string): string {
  const digest = createHash('sha256').update(sourceUrl).digest('hex').slice(0, 8)
  const stem = slugify(readable).slice(0, READABLE_LENGTH).replace(/-$/, '')
  return `${stem}-${digest}`
}
