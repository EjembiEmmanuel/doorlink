import { isDatabaseUnreachable } from '../../src/lib/db-errors'

/**
 * What to print when a manuals script dies.
 *
 * A database that is not running is the most common way these fail, and
 * it is not a bug in the script — it deserves one line saying so and the
 * command that fixes it, not a Prisma stack trace that buries the point.
 * Everything else still gets the full error, because everything else
 * might be a real defect.
 *
 * Reuses the app's own `isDatabaseUnreachable` rather than matching on
 * the message, so the scripts and the pages agree on what "the database
 * is down" means.
 */
export function reportFailure(error: unknown): never {
  if (isDatabaseUnreachable(error)) {
    console.error('\nThe database is not reachable, so nothing was read or written.')
    console.error('Start it and run this again. DATABASE_URL is read from .env.')
  } else {
    console.error(error)
  }
  process.exit(1)
}
