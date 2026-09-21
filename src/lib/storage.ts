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

export const MANUAL_UPLOAD_MAX_BYTES = 25 * 1024 * 1024
export const MANUAL_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

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
export async function uploadFile(file: File, key: string): Promise<StoredFileRef> {
  if (!canUpload()) {
    throw new StorageUnavailableError(
      'File upload needs Supabase Storage. Configure Supabase Storage before uploading a manual.'
    )
  }

  if (!MANUAL_UPLOAD_MIME_TYPES.includes(file.type as (typeof MANUAL_UPLOAD_MIME_TYPES)[number])) {
    throw new Error('That file type is not supported. Use PDF, DOC, DOCX, JPG, PNG, or WEBP.')
  }
  if (file.size > MANUAL_UPLOAD_MAX_BYTES) {
    throw new Error('That file is too large. Manual files must be 25 MB or smaller.')
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const bucket = process.env.SUPABASE_STORAGE_BUCKET
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !bucket || !serviceKey) {
    throw new StorageUnavailableError('Supabase Storage is not fully configured.')
  }

  const response = await fetch(`${base.replace(/\/$/, '')}/storage/v1/object/${bucket}/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'false',
    },
    body: Buffer.from(await file.arrayBuffer()),
  })

  if (!response.ok) {
    throw new Error(`Storage rejected the upload (${response.status}). Try again or use a public source link.`)
  }

  return { key }
}

/**
 * Resolve a private contribution only for a short-lived admin review link.
 * Public manual pages must continue to use manualAccess(), never this
 * helper, so an uploaded file cannot become public by accident.
 */
export async function createSignedFileUrl(key: string, expiresIn = 300): Promise<string | null> {
  if (activeStorageBackend() !== 'supabase') return null
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const bucket = process.env.SUPABASE_STORAGE_BUCKET
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !bucket || !serviceKey) return null

  const response = await fetch(`${base.replace(/\/$/, '')}/storage/v1/object/sign/${bucket}/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ expiresIn }),
  })
  if (!response.ok) return null

  const body = (await response.json()) as { signedURL?: string }
  if (!body.signedURL) return null
  return body.signedURL.startsWith('http')
    ? body.signedURL
    : `${base.replace(/\/$/, '')}/storage/v1${body.signedURL}`
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
