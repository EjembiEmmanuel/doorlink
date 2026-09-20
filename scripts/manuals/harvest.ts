import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  extractDocumentLinks,
  isDisallowed,
  parseRobots,
  type HarvestCandidate,
} from '../../src/lib/manuals/harvest-parse'

// Harvests document links from manufacturer documentation portals.
//
// This is what makes the library scale. Searching model by model finds a
// handful of documents per query; a manufacturer's own download index
// lists hundreds in one page. One portal crawled well is worth a
// thousand searches.
//
// What it collects: URLs, link text, and the file name. Metadata about
// where a document lives — never the document's contents. Doorlink links
// to the publisher's copy; it does not reproduce it.
//
// What it will not do:
//
// - Ignore robots.txt. The portal list is public documentation, but a
//   crawler that overrides a site's own stated rules is a crawler that
//   gets Doorlink's IP blocked and deserves to be.
// - Touch anything behind a login, a paywall or a CAPTCHA. A 401 or 403
//   is recorded as restricted and the URL is left alone.
// - Hammer a host. One request at a time, spaced, with a user agent that
//   says who it is.
// - Write to the database. Output lands in data/manuals/harvested/ as
//   candidates for a person to review before import, because a crawler's
//   guess at "which model is this manual for" is a guess, and guesses
//   should not silently become catalogue records.

const USER_AGENT =
  'DoorlinkDocHarvester/1.0 (+https://doorlink.example/manuals; collecting documentation links)'
const DELAY_MS = Number(process.env.MANUALS_HARVEST_DELAY_MS ?? 2000)
const TIMEOUT_MS = Number(process.env.MANUALS_HARVEST_TIMEOUT_MS ?? 20000)

const DATA_DIR = join(process.cwd(), 'data', 'manuals')
const OUT_DIR = join(DATA_DIR, 'harvested')

interface Portal {
  manufacturer: string
  slug: string | null
  url: string
  authority: string
  region: string
  note?: string
}

// Always unreviewed out of the harvester: a person decides.
type Candidate = HarvestCandidate

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------------
// robots.txt
// ---------------------------------------------------------------------

const robotsCache = new Map<string, string[]>()

/**
 * Disallow rules for our user agent, falling back to `*`. Deliberately a
 * simple prefix matcher: it errs toward not fetching, which is the right
 * direction to err in.
 */
async function disallowedPaths(origin: string): Promise<string[]> {
  if (robotsCache.has(origin)) return robotsCache.get(origin)!

  let rules: string[] = []
  try {
    const response = await fetch(`${origin}/robots.txt`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (response.ok) {
      rules = parseRobots(await response.text(), USER_AGENT)
    }
  } catch {
    // No robots.txt, or it could not be read. Absence of a rule is not
    // permission to be rude, but it is not a prohibition either — the
    // rate limit below still applies.
    rules = []
  }

  robotsCache.set(origin, rules)
  return rules
}

async function allowed(url: string): Promise<boolean> {
  const rules = await disallowedPaths(new URL(url).origin)
  return !isDisallowed(url, rules)
}

// ---------------------------------------------------------------------
// Harvest
// ---------------------------------------------------------------------

interface PortalResult {
  portal: Portal
  status: 'ok' | 'restricted' | 'blocked-by-robots' | 'unreachable' | 'no-documents'
  httpStatus: number | null
  reason?: string
  candidates: Candidate[]
}

async function harvestPortal(portal: Portal): Promise<PortalResult> {
  const base = { portal, candidates: [] as Candidate[] }

  if (!(await allowed(portal.url))) {
    return { ...base, status: 'blocked-by-robots', httpStatus: null, reason: 'Disallowed by robots.txt' }
  }

  try {
    const response = await fetch(portal.url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (response.status === 401 || response.status === 403) {
      // Says what came back, not why. A 403 can be a login wall, a
      // firewall, geo-blocking, or an intermediary proxy refusing the
      // request — and the difference matters to whoever reads this.
      // Either way the harvester stops here and does not try to get
      // around it.
      return {
        ...base,
        status: 'restricted',
        httpStatus: response.status,
        reason:
          `Server returned ${response.status}. Could be a login wall, a firewall, or a network ` +
          'intermediary. Not retried and not worked around.',
      }
    }
    if (!response.ok) {
      return { ...base, status: 'unreachable', httpStatus: response.status, reason: `HTTP ${response.status}` }
    }

    const html = await response.text()
    const candidates = extractDocumentLinks(html, response.url)

    if (candidates.length === 0) {
      return {
        ...base,
        status: 'no-documents',
        httpStatus: response.status,
        reason:
          'No document links in the served HTML. The index may be built by JavaScript, which this harvester does not execute.',
      }
    }

    return { portal, status: 'ok', httpStatus: response.status, candidates }
  } catch (error) {
    return {
      ...base,
      status: 'unreachable',
      httpStatus: null,
      reason: error instanceof Error ? error.message : 'Request failed',
    }
  }
}

async function main() {
  const registry = JSON.parse(readFileSync(join(DATA_DIR, 'portals.json'), 'utf8')) as {
    portals: Portal[]
  }

  const only = process.argv[2]
  const portals = only
    ? registry.portals.filter((p) => p.slug === only || p.manufacturer.toLowerCase() === only.toLowerCase())
    : registry.portals

  if (portals.length === 0) {
    console.log(`No portal matches "${only}". See data/manuals/portals.json.`)
    return
  }

  mkdirSync(OUT_DIR, { recursive: true })
  console.log(`Harvesting ${portals.length} portal(s), ${DELAY_MS}ms apart.\n`)

  const results: PortalResult[] = []
  for (const portal of portals) {
    const result = await harvestPortal(portal)
    results.push(result)
    console.log(
      `  ${String(result.httpStatus ?? '---').padEnd(4)} ${result.status.padEnd(18)} ` +
        `${String(result.candidates.length).padStart(4)} docs  ${portal.manufacturer} — ${portal.url}` +
        (result.reason ? `\n         ${result.reason}` : '')
    )
    await sleep(DELAY_MS)
  }

  const harvested = results.filter((r) => r.candidates.length > 0)
  const total = harvested.reduce((sum, r) => sum + r.candidates.length, 0)

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outFile = join(OUT_DIR, `harvest-${stamp}.json`)
  writeFileSync(
    outFile,
    `${JSON.stringify(
      {
        harvestedAt: new Date().toISOString(),
        note:
          'Candidate document links awaiting review. inferredKind and inferredModel are guesses made ' +
          'from link text and file names — check them before importing. Nothing here is in the ' +
          'database, and nothing here is verified.',
        totals: {
          portals_attempted: results.length,
          portals_yielding: harvested.length,
          candidate_documents: total,
        },
        results: results.map((r) => ({
          manufacturer: r.portal.manufacturer,
          slug: r.portal.slug,
          portalUrl: r.portal.url,
          authority: r.portal.authority,
          region: r.portal.region,
          status: r.status,
          httpStatus: r.httpStatus,
          reason: r.reason ?? null,
          candidates: r.candidates,
        })),
      },
      null,
      2
    )}\n`
  )

  console.log(`\n${total} candidate document(s) from ${harvested.length}/${results.length} portal(s).`)
  console.log(`Written to ${outFile}`)
  console.log(
    '\nNothing was imported. Review the candidates, fold the good ones into a ' +
      'data/manuals/<manufacturer>.json file, then run `npm run manuals:import`.'
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
