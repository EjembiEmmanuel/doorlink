import type { Role } from '@prisma/client'
import type { Session } from './auth'

// The permission matrix is the source of truth for access — routes and
// components check `can()` or call the guards below, never `role === '...'`.
export type Permission =
  | 'catalogue:read'
  | 'catalogue:write'
  | 'listing:read'
  | 'listing:write:own'
  | 'listing:write:any'
  | 'order:read:own'
  | 'order:read:any'
  | 'job:read:own'
  | 'job:write:own'
  | 'job:write:any'
  | 'lead:read:assigned'
  | 'lead:write:own'
  | 'lead:write:any'
  // Seeing the open job board and quoting on it. Separate from
  // lead:write:* because "can bid for work" and "can administer other
  // people's requests" are genuinely different powers.
  | 'marketplace:quote'
  | 'marketplace:hire'
  | 'support:read:own'
  | 'support:write:any'
  | 'import:write'
  | 'admin:settings'

// listing:write:own is granted to every role — DoorLink's marketplace is
// peer-to-peer (anyone with an account can list an item, business or
// not), not gated behind registering as a Supplier organization. What
// still differs by role is listing:write:any (moderate anyone's listing)
// and whether an account happens to have a supplier organization
// attached, which changes who a listing is sold *as*, not whether it can
// be created at all.
const MATRIX: Record<Role, Permission[]> = {
  CUSTOMER: [
    'catalogue:read',
    'listing:read',
    'listing:write:own',
    'order:read:own',
    'job:read:own',
    'job:write:own',
    'marketplace:hire',
    'support:read:own',
  ],
  TECHNICIAN: [
    'catalogue:read',
    'listing:read',
    'listing:write:own',
    'job:read:own',
    'job:write:own',
    'lead:read:assigned',
    'lead:write:own',
    'marketplace:quote',
    'marketplace:hire',
    'support:read:own',
  ],
  SUPPLIER: [
    'catalogue:read',
    'listing:read',
    'listing:write:own',
    'order:read:any',
    'marketplace:hire',
    'support:read:own',
  ],
  MANUFACTURER: [
    'catalogue:read',
    'catalogue:write',
    'listing:read',
    'listing:write:own',
    'import:write',
    'marketplace:hire',
    'support:read:own',
  ],
  ADMIN: [
    'catalogue:read',
    'catalogue:write',
    'listing:read',
    'listing:write:own',
    'listing:write:any',
    'order:read:any',
    'job:read:own',
    'job:write:any',
    'lead:read:assigned',
    'lead:write:any',
    'marketplace:quote',
    'marketplace:hire',
    'support:read:own',
    'support:write:any',
    'import:write',
    'admin:settings',
  ],
}

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role]?.includes(permission) ?? false
}

export class RbacError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'RbacError'
    this.status = status
  }
}

export function requireSession(session: Session | null): Session {
  if (!session) throw new RbacError('Sign-in required', 401)
  return session
}

export function requirePermission(session: Session | null, permission: Permission): Session {
  const active = requireSession(session)
  if (!can(active.role, permission)) throw new RbacError('Not permitted', 403)
  return active
}
