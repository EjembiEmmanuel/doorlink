'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { requireSession, RbacError } from '@/lib/rbac'
import { isDatabaseUnreachable } from '@/lib/db-errors'

export type ContactActionState = { error?: string; ok?: boolean }

/**
 * Australian numbers as people actually type them: with or without +61,
 * with or without spaces or brackets. This is a shape check, not proof
 * the number exists — nothing here dials it, and the UI must not imply
 * the number has been confirmed.
 */
const PHONE_PATTERN = /^(?:\+?61|0)[\s-]?[2-478](?:[\s-]?\d){8}$/

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(120, 'That name is too long.'),
  phone: z
    .string()
    .trim()
    .max(24, 'That phone number is too long.')
    .refine((value) => value === '' || PHONE_PATTERN.test(value), {
      message: 'Enter an Australian phone number, like 0412 345 678 or (03) 9123 4567.',
    }),
})

export async function updateContactAction(
  _prevState: ContactActionState,
  formData: FormData
): Promise<ContactActionState> {
  let userId: string
  try {
    userId = requireSession(await getSession()).userId
  } catch (error) {
    if (error instanceof RbacError) return { error: error.message }
    throw error
  }

  const parsed = contactSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone') ?? '',
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: parsed.data.name,
        // Empty clears the number rather than storing an empty string, so
        // "has a contact number" stays a single question everywhere.
        phone: parsed.data.phone === '' ? null : parsed.data.phone,
      },
    })
  } catch (error) {
    if (isDatabaseUnreachable(error)) {
      return { error: "Couldn't save that. The database is not reachable right now." }
    }
    throw error
  }

  revalidatePath('/account')
  revalidatePath('/welcome')
  return { ok: true }
}
