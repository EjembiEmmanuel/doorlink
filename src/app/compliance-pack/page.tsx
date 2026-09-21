import { permanentRedirect } from 'next/navigation'

/**
 * `/compliance-pack` was a second, parallel landing page for the same
 * $29.99 product as `/compliance`. Two pages selling one thing is a
 * problem on its own; the worse part was which one the homepage pointed
 * at. This page held business details in React state only — "Save pack
 * details" set a flag and the form told the buyer their details were
 * "ready for checkout" when nothing had been stored — while
 * `/compliance` persists the same details to ComplianceProfile, gates
 * the pack on a real purchase row, and can actually issue documents.
 *
 * Kept as a redirect rather than deleted: the route shipped to main and
 * the homepage linked to it, so anything already pointing here keeps
 * working. Permanent, because this address is not coming back.
 */
export default function CompliancePackRedirect() {
  permanentRedirect('/compliance')
}
