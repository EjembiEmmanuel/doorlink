'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { requireSession, RbacError } from '@/lib/rbac'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { parseSpec } from '@/lib/configurator/options'
import { makeReference } from '@/lib/reference'

export type ConfigurationActionState = { error?: string; savedId?: string }

const schema = z.object({
  name: z.string().trim().min(1, 'Give it a name.').max(120),
  spec: z.string().trim().min(2),
})

export async function saveConfigurationAction(
  _prevState: ConfigurationActionState,
  formData: FormData
): Promise<ConfigurationActionState> {
  let userId: string
  try {
    userId = requireSession(await getSession()).userId
  } catch (error) {
    if (error instanceof RbacError) return { error: error.message }
    throw error
  }

  const parsed = schema.safeParse({ name: formData.get('name'), spec: formData.get('spec') })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }

  let raw: unknown
  try {
    raw = JSON.parse(parsed.data.spec)
  } catch {
    return { error: 'That configuration could not be read.' }
  }

  // Re-parsed server-side rather than stored as received: the spec came
  // from a form field, and a form field is not a validated document.
  const spec = parseSpec(raw)

  try {
    const saved = await prisma.doorConfiguration.create({
      data: {
        userId,
        name: parsed.data.name,
        spec: spec as unknown as object,
        // A share link that is not guessable from the id, so sharing one
        // configuration does not expose the next person's.
        shareSlug: makeReference('CFG').toLowerCase(),
      },
    })
    revalidatePath('/saved')
    return { savedId: saved.id }
  } catch (error) {
    if (isDatabaseUnreachable(error)) return { error: 'The database is not reachable right now.' }
    throw error
  }
}
