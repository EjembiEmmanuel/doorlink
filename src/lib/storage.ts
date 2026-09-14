import { isConnected } from './integrations'

// File storage behind one interface so the Supabase Storage adapter can
// replace the local one without any caller changing.
//
// A fileKey is a storage-relative path ("manuals/faac/e045-rev-c.pdf"),
// never a URL — resolving a key to something fetchable is this module's
// job, and only this module's. Callers that build their own URLs are how
// a storage migration turns into a hunt through the codebase.

export interface StoredFileRef {
  /** Storage-relative key, e.g. "manuals/faac/e045-732786-rev-c.pdf". */
  key: string
}

export type StorageBackend = 'local-public' | 'supabase'

export function activeStorageBackend(): StorageBackend {
  return isConnected('storage') ? 'supabase' : 'local-public'
}

// Files under the local backend live in public/ and are served directly
// by Next. That is fine for manufacturer manuals, which are public
// documents by nature — it would not be fine for anything private
// (verification documents, message attachments), which is why
// `isPubliclyServable` exists and callers for private files must check
// it rather than assuming every key can be linked to.
const PUBLIC_PREFIXES = ['manuals/']

export function isPubliclyServable(key: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => key.startsWith(prefix))
}

/**
 * Resolve a storage key to a URL the browser can fetch, or null when the
 * active backend cannot serve it — a private key on the local backend,
 * or any key while Supabase Storage is unconfigured. Callers render a
 * "not connected" state on null rather than linking to a 404.
 */
export function resolveFileUrl(key: string): string | null {
  if (activeStorageBackend() === 'supabase') {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL
    const bucket = process.env.SUPABASE_STORAGE_BUCKET
    if (!base || !bucket) return null
    return `${base.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${key}`
  }

  if (!isPubliclyServable(key)) return null
  return `/${key}`
}

/**
 * Upload is deliberately not implemented against the local backend.
 * Writing into public/ at runtime would work in dev and silently fail on
 * any real deployment with a read-only or ephemeral filesystem, which is
 * exactly the kind of "works on my machine" behaviour this codebase
 * avoids. Until Supabase Storage is configured, uploads report as
 * unavailable and the UI says so.
 */
export async function uploadFile(): Promise<never> {
  throw new StorageUnavailableError(
    'File upload needs Supabase Storage. Configure SUPABASE_SERVICE_ROLE_KEY and SUPABASE_STORAGE_BUCKET.'
  )
}

export class StorageUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageUnavailableError'
  }
}

export function canUpload(): boolean {
  return activeStorageBackend() === 'supabase'
}
