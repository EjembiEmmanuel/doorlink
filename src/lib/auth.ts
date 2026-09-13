import { cookies } from 'next/headers'
import type { Role } from '@prisma/client'
import { prisma } from './prisma'
import { isDatabaseUnreachable } from './db-errors'
import { DEV_SESSION_COOKIE } from './session-cookie'

export type Session = {
  userId: string
  email: string
  name: string
  role: Role
  organizationId: string | null
}

interface SessionProvider {
  getSession(): Promise<Session | null>
}

// Reads a plain email out of a cookie and loads the matching demo user.
// Sets no passwords and refuses to run in production, so it can never
// stand in for real authentication once deployed.
class DevCookieSessionProvider implements SessionProvider {
  async getSession(): Promise<Session | null> {
    if (process.env.NODE_ENV === 'production') return null

    const store = await cookies()
    const email = store.get(DEV_SESSION_COOKIE)?.value
    if (!email) return null

    let user
    try {
      user = await prisma.user.findUnique({
        where: { email },
        include: { memberships: true },
      })
    } catch (error) {
      // getSession() runs on every page via the header. A database outage
      // shouldn't take the whole site down over something as recoverable
      // as "can't confirm who's signed in" — fail to signed-out instead.
      if (isDatabaseUnreachable(error)) return null
      throw error
    }
    if (!user) return null

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.memberships[0]?.organizationId ?? null,
    }
  }
}

// The one place a real provider (Supabase) gets swapped in — every route
// and component below only ever calls getSession().
const sessionProvider: SessionProvider = new DevCookieSessionProvider()

export function getSession(): Promise<Session | null> {
  return sessionProvider.getSession()
}
