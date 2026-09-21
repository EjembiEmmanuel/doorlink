import 'server-only'

import type { Session } from '../auth'
import { can, RbacError, requireSession } from '../rbac'

// The isolation boundary for the inspection engine.
//
// Every client, site, asset and inspection belongs to exactly one
// Organization, and a query that forgets to say which one returns
// another company's customer list. That is not a bug that announces
// itself — the page renders fine, with the wrong data — so the scope is
// not left to each call site to remember.
//
// The rule: reads and writes filter on the value returned by
// `requireInspectionScope`, and there is no code path that takes an
// organizationId from a form, a query string, or a route param. Those
// are all attacker-controlled; the session is not.

export interface InspectionScope {
  session: Session
  organizationId: string
}

/**
 * Thrown when a signed-in user has no organisation. The inspection
 * engine is an organisation's asset register, so there is nothing
 * coherent to show someone who is not in one — the page offers to set
 * one up rather than showing an empty register that silently belongs to
 * nobody.
 */
export class NoOrganizationError extends Error {
  constructor() {
    super('An organisation is required to use inspections.')
    this.name = 'NoOrganizationError'
  }
}

export function requireInspectionScope(
  session: Session | null,
  permission: 'inspection:read' | 'inspection:write' | 'asset:write' = 'inspection:read'
): InspectionScope {
  const active = requireSession(session)
  if (!can(active.role, permission)) throw new RbacError('Not permitted', 403)
  if (!active.organizationId) throw new NoOrganizationError()
  return { session: active, organizationId: active.organizationId }
}

/**
 * The `where` fragment every inspection-side query starts from. Spelled
 * as a helper so a missing scope is visible as a missing call rather
 * than as an absent property nobody notices in review.
 */
export function scopedTo({ organizationId }: InspectionScope): { organizationId: string } {
  return { organizationId }
}
