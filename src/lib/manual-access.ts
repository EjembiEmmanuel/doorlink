import { DocumentRights, VerificationState } from '@prisma/client'
import { resolveFileUrl } from './storage'

// How a document can actually be opened, decided in one place.
//
// A manual reaches a reader one of two ways: Doorlink serves a copy it
// is entitled to host, or Doorlink sends them to the publisher's own
// copy. Which one applies depends on rights and on whether a file was
// ever stored, and getting that wrong means either a dead button or
// redistributing something Doorlink has no licence to.
//
// The default is the link. "Publicly downloadable" is not "free to
// redistribute", and a manufacturer PDF that anyone can fetch is still
// the manufacturer's document.

export type ManualAccess =
  | {
      mode: 'hosted'
      url: string
      /** True when Doorlink holds it under an explicit grant. */
      redistributable: boolean
    }
  | {
      mode: 'link'
      url: string
      /** Shown beside the link so nobody thinks Doorlink vouches for a mirror. */
      external: true
    }
  | {
      mode: 'restricted'
      /** Behind a login or portal. Doorlink records it and stops there. */
      url: string | null
    }
  | {
      mode: 'unavailable'
      reason: 'no-source' | 'link-broken'
    }

export interface AccessibleDocument {
  fileKey: string | null
  sourceUrl: string | null
  rights: DocumentRights
  verification: VerificationState
}

export function manualAccess(doc: AccessibleDocument): ManualAccess {
  // A document behind a login is recorded, never fetched around. Said
  // plainly rather than shown as a link that will bounce the reader to
  // a sign-in page they cannot pass.
  if (doc.verification === VerificationState.RESTRICTED) {
    return { mode: 'restricted', url: doc.sourceUrl }
  }

  // Serving a stored copy requires both a file and a reason to believe
  // Doorlink may serve it. LINK_ONLY with a file present is not a
  // contradiction — it can happen after a rights review downgrades a
  // document — and the link is what wins.
  const mayHost =
    doc.rights === DocumentRights.REDISTRIBUTABLE || doc.rights === DocumentRights.OWN_CONTENT
  if (doc.fileKey && mayHost) {
    const hosted = resolveFileUrl(doc.fileKey)
    if (hosted) {
      return {
        mode: 'hosted',
        url: hosted,
        redistributable: doc.rights === DocumentRights.REDISTRIBUTABLE,
      }
    }
  }

  if (doc.sourceUrl) {
    // A link already known to be dead is not offered. Saying so beats
    // sending someone to a 404 and letting them conclude the manual
    // never existed.
    if (doc.verification === VerificationState.BROKEN) {
      return { mode: 'unavailable', reason: 'link-broken' }
    }
    return { mode: 'link', url: doc.sourceUrl, external: true }
  }

  return { mode: 'unavailable', reason: 'no-source' }
}

/**
 * Whether this record is safe to present as the manufacturer's own
 * document. Both halves matter: who published it, and whether anyone
 * confirmed the link still resolves. An unverified record from an
 * official domain is still unverified, and the badge says so.
 */
export function isConfirmedOfficial(doc: {
  origin: string
  verification: VerificationState
}): boolean {
  return (
    doc.origin === 'MANUFACTURER_ORIGINAL' &&
    (doc.verification === VerificationState.REACHABLE ||
      doc.verification === VerificationState.REDIRECTED)
  )
}
