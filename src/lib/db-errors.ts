import { Prisma } from '@prisma/client'

// Connection-shaped Prisma errors — a missing DATABASE_URL, the server
// refusing connections, auth failing, the pool timing out — as opposed to
// a bug in a query. Used to decide when a route should render/return an
// honest "not connected" state instead of a generic error.
const CONNECTION_ERROR_CODES = new Set([
  'P1000', // authentication failed
  'P1001', // can't reach database server
  'P1002', // database server timed out
  'P1003', // database does not exist
  'P1008', // operation timed out
  'P1010', // access denied
  'P1011', // TLS connection error
  'P1017', // server closed the connection
])

export function isDatabaseUnreachable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return CONNECTION_ERROR_CODES.has(error.code)
  }
  return false
}
