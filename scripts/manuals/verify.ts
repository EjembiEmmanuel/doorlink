import { PrismaClient, VerificationState } from '@prisma/client'

// Checks that recorded document links actually resolve.
//
// This exists because "a search engine returned this URL" and "this URL
// serves this document" are different claims, and only the second one
// justifies showing a reader an official badge. The importer never makes
// that claim; this is the only thing that can.
//
// Rules it follows:
//
// - A failure flags the record, it never deletes it. A manufacturer's
//   site being down for an afternoon is not evidence a manual ceased to
//   exist, and silently dropping records would quietly shrink the
//   library every time someone's CDN hiccupped.
// - A login wall, a paywall or a portal is recorded as RESTRICTED and
//   left alone. Doorlink does not attempt to get around any of them.
// - Requests are spaced out and identify themselves. Hammering a
//   manufacturer's site to build a link checker would be rude and would
//   get Doorlink blocked.

const prisma = new PrismaClient()

const USER_AGENT =
  'DoorlinkLinkChecker/1.0 (+https://doorlink.example/manuals; verifying documentation links)'
const DELAY_MS = Number(process.env.MANUALS_VERIFY_DELAY_MS ?? 1500)
const TIMEOUT_MS = Number(process.env.MANUALS_VERIFY_TIMEOUT_MS ?? 15000)
const LIMIT = Number(process.env.MANUALS_VERIFY_LIMIT ?? 250)

interface CheckResult {
  state: VerificationState
  status: number | null
  reason?: string
  redirectedTo?: string
}

async function check(url: string): Promise<CheckResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    // HEAD first: it is the polite way to ask "is this still there".
    // Plenty of servers refuse it, so a non-2xx HEAD falls through to a
    // GET rather than being treated as an answer.
    let response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    })

    if (!response.ok) {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT },
      })
    }

    const status = response.status
    const landed = response.url

    if (status === 401 || status === 403) {
      return { state: VerificationState.RESTRICTED, status, reason: 'Requires authentication' }
    }
    if (status === 404 || status === 410) {
      return { state: VerificationState.BROKEN, status, reason: 'Not found at this address' }
    }
    if (!response.ok) {
      // 5xx and the rest: the server is unhappy, but that is not the
      // same as the document being gone. Flagged, not condemned.
      return { state: VerificationState.UNVERIFIED, status, reason: `Server returned ${status}` }
    }

    // A redirect into a sign-in page reports 200 and is not the
    // document. Treated as restricted rather than reachable.
    if (/\/(login|signin|sign-in|account|auth)\b/i.test(new URL(landed).pathname)) {
      return {
        state: VerificationState.RESTRICTED,
        status,
        reason: 'Redirects to a sign-in page',
        redirectedTo: landed,
      }
    }

    if (landed !== url) {
      return { state: VerificationState.REDIRECTED, status, redirectedTo: landed }
    }

    return { state: VerificationState.REACHABLE, status }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Request failed'
    // Network failure says nothing about the document. Left UNVERIFIED
    // and flagged so a person can look.
    return { state: VerificationState.UNVERIFIED, status: null, reason }
  } finally {
    clearTimeout(timer)
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  const documents = await prisma.document.findMany({
    where: { sourceUrl: { not: null } },
    select: { id: true, title: true, sourceUrl: true, verification: true },
    orderBy: [{ lastVerifiedAt: { sort: 'asc', nulls: 'first' } }],
    take: LIMIT,
  })

  if (documents.length === 0) {
    console.log('No documents with a source URL. Run `npm run manuals:import` first.')
    return
  }

  console.log(`Checking ${documents.length} document link(s), ${DELAY_MS}ms apart.\n`)

  const tally: Record<string, number> = {}

  for (const doc of documents) {
    const result = await check(doc.sourceUrl!)
    tally[result.state] = (tally[result.state] ?? 0) + 1

    const flag =
      result.state === VerificationState.BROKEN ||
      result.state === VerificationState.RESTRICTED ||
      (result.state === VerificationState.UNVERIFIED && result.reason !== undefined)

    await prisma.document.update({
      where: { id: doc.id },
      data: {
        verification: result.state,
        lastVerifiedAt: new Date(),
        lastHttpStatus: result.status,
        needsReview: flag,
        reviewReason: result.reason ?? null,
      },
    })

    const label = result.redirectedTo ? `${result.state} → ${result.redirectedTo}` : result.state
    console.log(
      `  ${result.status ?? '---'}  ${label.padEnd(28)} ${doc.title.slice(0, 60)}${result.reason ? `  (${result.reason})` : ''}`
    )

    await sleep(DELAY_MS)
  }

  console.log('\nResult:')
  for (const [state, count] of Object.entries(tally).sort()) {
    console.log(`  ${state.padEnd(14)} ${count}`)
  }
  console.log('\nNothing was deleted. Anything flagged is in the admin review queue.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
