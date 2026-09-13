'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'

export type RequestFormState = { error?: string }

// No sign-in required to submit one — name/email/phone are captured
// directly in the form, matching the low-friction, contact-by-email
// pattern the marketplace already uses. A technician sees the request in
// /leads and reaches out directly; there's no account to track it from.
const createLeadSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  phone: z.string().trim().optional(),
  message: z.string().trim().min(1, 'Describe what you need help with.'),
  modelId: z.string().trim().optional(),
})

export async function createLeadAction(_prevState: RequestFormState, formData: FormData): Promise<RequestFormState> {
  const parsed = createLeadSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone') || undefined,
    message: formData.get('message'),
    modelId: formData.get('modelId') || undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }
  }

  try {
    await prisma.lead.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        message: parsed.data.message,
        modelId: parsed.data.modelId || null,
      },
    })
  } catch (error) {
    if (isDatabaseUnreachable(error)) return { error: 'The request database is not reachable right now.' }
    throw error
  }

  redirect('/request-technician/thanks')
}
