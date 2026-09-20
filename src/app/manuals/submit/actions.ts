'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { createSubmission } from '@/lib/manuals/submissions'
import { MAX_FILE_BYTES } from '@/lib/manuals/submission-files'

export type SubmitState = { error?: string; ok?: boolean; reference?: string }

const schema = z.object({
  manufacturerName: z.string().trim().min(1, 'Which manufacturer made it?').max(120),
  productName: z.string().trim().min(1, 'What is the product called?').max(160),
  modelCode: z.string().trim().min(1, 'The model number is on the unit or the manual.').max(80),
  categorySlug: z.string().trim().min(1, 'Pick the closest category.').max(80),
  // Optional throughout, per the brief: a submitter must not be blocked
  // on things they cannot reasonably know about someone else's hardware.
  serialNumber: z.string().trim().max(120).optional().transform((v) => v || null),
  year: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number.parseInt(v, 10) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 1950 && v <= new Date().getFullYear() + 1), {
      message: 'That year does not look right.',
    }),
  description: z.string().trim().max(2000).optional().transform((v) => v || null),
})

export async function submitManual(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const session = await getSession()
  if (!session) return { error: 'Sign in to add a manual.' }
  if (!can(session.role, 'manual:submit')) {
    return { error: 'This account cannot add manuals.' }
  }

  const parsed = schema.safeParse({
    manufacturerName: formData.get('manufacturerName'),
    productName: formData.get('productName'),
    modelCode: formData.get('modelCode'),
    categorySlug: formData.get('categorySlug'),
    serialNumber: formData.get('serialNumber') ?? undefined,
    year: formData.get('year') ?? undefined,
    description: formData.get('description') ?? undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the details and try again.' }
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose the manual file to upload.' }
  }
  // Checked before the bytes are read into memory. The real validation
  // happens on the bytes themselves in createSubmission — this is only
  // here so a hostile upload is refused before it is buffered.
  if (file.size > MAX_FILE_BYTES) {
    return { error: `That file is larger than the ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB limit.` }
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const result = await createSubmission({
      submittedById: session.userId,
      ...parsed.data,
      filename: file.name,
      bytes,
    })
    if (!result.ok) return { error: result.message }

    revalidatePath('/manuals/submit')
    return { ok: true, reference: result.reference }
  } catch (error) {
    if (isDatabaseUnreachable(error)) {
      return { error: "Can't reach the database right now. Nothing was saved — try again shortly." }
    }
    throw error
  }
}
