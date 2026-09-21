// Parsing and inference for the documentation harvester.
//
// Separated from the crawler so it can be tested without a network:
// given a page's HTML, does it find the right document links, and does
// it guess the right document type — and, more importantly, does it
// refuse to guess when it should?
//
// The refusals are the part worth testing. A wrong model attribution
// puts the wrong manual in front of someone working on a live door.

export interface HarvestCandidate {
  url: string
  linkText: string
  fileName: string
  inferredKind: string | null
  inferredModel: string | null
  reviewed: false
}

// Mapped from words that appear in real document link text. Order
// matters: "installation and operating instructions" should read as an
// installation manual, so the more specific terms are tested first.
const KIND_PATTERNS: [RegExp, string][] = [
  [/wiring|circuit|schematic/i, 'WIRING_DIAGRAM'],
  [/spare\s*part|parts\s*(list|manual|catalogue)/i, 'PARTS_LIST'],
  [/programm?ing|coding|remote\s*set/i, 'PROGRAMMING_GUIDE'],
  [/trouble\s*shoot|fault|error\s*code|diagnos/i, 'TROUBLESHOOTING_GUIDE'],
  [/install/i, 'INSTALL_MANUAL'],
  [/owner|user\s*(manual|guide)|operating/i, 'USER_MANUAL'],
  [/spec(ification)?\s*sheet|datasheet|data\s*sheet/i, 'SPEC_SHEET'],
  [/safety/i, 'SAFETY_DOCUMENT'],
  [/warrant/i, 'WARRANTY'],
  [/declaration\s*of\s*conformity/i, 'DECLARATION_OF_CONFORMITY'],
  [/quick\s*start/i, 'QUICK_START'],
  [/service\s*bulletin/i, 'SERVICE_BULLETIN'],
]

export function inferKind(text: string, fileName: string): string | null {
  const haystack = `${text} ${fileName}`
  for (const [pattern, kind] of KIND_PATTERNS) {
    if (pattern.test(haystack)) return kind
  }
  return null
}

/**
 * A model code, if one is plainly visible.
 *
 * Matches only shapes that read unambiguously as a model designation:
 * two or more letters, then two to four digits, optionally separated
 * and optionally suffixed. Returns null readily — a wrong attribution
 * is worse than none, so this is built to give up rather than reach.
 */
export function inferModel(text: string, fileName: string): string | null {
  // Underscores are word characters, so `manual_sd800` offers no word
  // boundary before the code — and underscore-separated file names are
  // the common case on these portals. Treated as a separator here.
  const haystack = `${text} ${fileName}`.replace(/_/g, ' ')
  const match = haystack.match(/\b([A-Za-z]{2,}[-\s]?\d{2,4}(?:[A-Za-z]{1,4})?)\b/)
  if (!match) return null

  const candidate = match[1].trim()
  // A bare year is not a model number, and documentation file names are
  // full of them.
  if (/^(19|20)\d{2}$/.test(candidate.replace(/\D/g, '')) && !/[A-Za-z]/.test(candidate)) return null
  return candidate
}

export function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

export function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Document links on a page.
 *
 * A regex rather than a DOM parser: this runs against markup we do not
 * control and cannot test against, and pulling in a parser to read href
 * attributes is not worth the dependency. It will miss links built by
 * JavaScript — a known limitation the harvester reports rather than
 * hides.
 */
export function extractDocumentLinks(html: string, baseUrl: string): HarvestCandidate[] {
  const found = new Map<string, HarvestCandidate>()
  const anchor = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi

  let match: RegExpExecArray | null
  while ((match = anchor.exec(html)) !== null) {
    const [, rawHref, inner] = match
    if (/^(mailto:|tel:|javascript:|#)/i.test(rawHref.trim())) continue

    let absolute: URL
    try {
      absolute = new URL(decodeEntities(rawHref), baseUrl)
    } catch {
      continue
    }

    if (!/\.(pdf|docx?)$/i.test(absolute.pathname)) continue
    // The same document linked twice on one page is one document.
    if (found.has(absolute.href)) continue

    const fileName = decodeURIComponent(absolute.pathname.split('/').pop() ?? '')
    const linkText = stripTags(inner)

    found.set(absolute.href, {
      url: absolute.href,
      linkText,
      fileName,
      inferredKind: inferKind(linkText, fileName),
      inferredModel: inferModel(linkText, fileName),
      reviewed: false,
    })
  }

  return [...found.values()]
}

/**
 * Same-site page links worth following one level for documents.
 *
 * Some manufacturers do not link PDFs from their index at all. A
 * support centre lists one HTML article per document, and the file sits
 * behind that article. `extractDocumentLinks` sees nothing on such a
 * page and the harvester reports `no-documents`, which is accurate and
 * useless.
 *
 * This finds the article links so the harvester can take one step
 * further in. It is deliberately narrow:
 *
 * - Same origin only. Following off-site links turns a portal crawl
 *   into a crawl of the web.
 * - HTML-ish paths only — no extension, or one of the page extensions.
 *   A link to an image or a zip is not an article.
 * - No query-only or fragment variants of a path already seen, because
 *   those are usually the same article sorted differently.
 *
 * It does not decide whether a page is worth fetching. That judgement
 * belongs to the caller, which has the budget and the rate limit.
 */
export function extractPageLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl)
  const found = new Set<string>()
  const anchor = /<a\b[^>]*href\s*=\s*["']([^"']+)["']/gi

  let match: RegExpExecArray | null
  while ((match = anchor.exec(html)) !== null) {
    const rawHref = match[1].trim()
    if (/^(mailto:|tel:|javascript:|#)/i.test(rawHref)) continue
    // A malformed absolute href like `ht tp://broken` does not throw
    // when resolved — it silently becomes a relative path under the
    // current directory, and the harvester would then spend a request
    // on it. There is no valid page link with whitespace inside it.
    if (/\s/.test(rawHref)) continue

    let absolute: URL
    try {
      absolute = new URL(decodeEntities(rawHref), baseUrl)
    } catch {
      continue
    }

    if (absolute.origin !== base.origin) continue

    const last = absolute.pathname.split('/').pop() ?? ''
    const dot = last.lastIndexOf('.')
    if (dot > 0) {
      const extension = last.slice(dot + 1).toLowerCase()
      if (!['html', 'htm', 'php', 'asp', 'aspx', 'jsp'].includes(extension)) continue
    }

    // The page we are already on is not a link to follow.
    absolute.hash = ''
    if (absolute.pathname === base.pathname && absolute.search === base.search) continue

    found.add(absolute.href)
  }

  return [...found]
}

/**
 * Disallow rules from a robots.txt body, for our agent or `*`.
 * Returned as plain prefixes; matching is deliberately simple and errs
 * toward not fetching.
 */
export function parseRobots(body: string, userAgent: string): string[] {
  const rules: string[] = []
  let applies = false

  for (const rawLine of body.split('\n')) {
    const line = rawLine.split('#')[0].trim()
    if (!line) continue

    const separator = line.indexOf(':')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim().toLowerCase()
    const value = line.slice(separator + 1).trim()

    if (key === 'user-agent') {
      applies = value === '*' || userAgent.toLowerCase().includes(value.toLowerCase())
    } else if (key === 'disallow' && applies && value) {
      rules.push(value)
    }
  }

  return rules
}

export function isDisallowed(url: string, rules: readonly string[]): boolean {
  const { pathname } = new URL(url)
  return rules.some((rule) => pathname.startsWith(rule))
}
