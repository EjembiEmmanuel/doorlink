'use server'

import { DocumentKind } from '@prisma/client'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { requireSession, RbacError } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export type ManualSubmissionState = { error?: string }

const KINDS = [
  'INSTALL_MANUAL',
  'USER_MANUAL',
  'WIRING_DIAGRAM',
  'PARTS_LIST',
  'SPEC_SHEET',
  'WARRANTY',
  'SERVICE_BULLETIN',
  'PROGRAMMING_GUIDE',
  'TROUBLESHOOTING_GUIDE',
  'TECHNICAL_DOCUMENT',
  'SAFETY_DOCUMENT',
  'QUICK_START',
  'DECLARATION_OF_CONFORMITY',
] as const

const submissionSchema = z.object({
  title: z.string().trim().min(1, 'Enter the document title.').max(160),
  kind: z.enum(KINDS),
  manufacturer: z.string().trim().max(120).optional(),
  modelCode: z.string().trim().max(120).optional(),
  sourceUrl: z.string().trim().url('Enter a valid public link to the document.'),
  notes: z.string().trim().max(2000).optional(),
})

function optionalString(value: FormDataEntryValue | null): string | undefined {
  const text = typeof value === 'string' ? value.trim() : ''
  return text.length > 0 ? text : undefined
}

export async function submitManualAction(
  _previous: ManualSubmissionState,
  formData: FormData
): Promise<ManualSubmissionState> {
  let session
  try {
    session = requireSession(await getSession())
  } catch (error) {
    if (error instanceof RbacError) return { error: 'Sign in before submitting a manual.' }
    throw error
  }

  const parsed = submissionSchema.safeParse({
    title: formData.get('title'),
    kind: formData.get('kind'),
    manufacturer: optionalString(formData.get('manufacturer')),
    modelCode: optionalString(formData.get('modelCode')),
    sourceUrl: formData.get('sourceUrl'),
    notes: optionalString(formData.get('notes')),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }
  }

  const body = [
    'A user submitted a manual for review.',
    '',
    `Title: ${parsed.data.title}`,
    `Document type: ${DocumentKind[parsed.data.kind]}`,
    `Manufacturer: ${parsed.data.manufacturer ?? 'Not supplied'}`,
    `Model code: ${parsed.data.modelCode ?? 'Not supplied'}`,
    `Public document link: ${parsed.data.sourceUrl}`,
    '',
    parsed.data.notes ? `Contributor notes:\n${parsed.data.notes}` : 'Contributor notes: None',
    '',
    'This submission must be checked for provenance and file availability before it is added to the public manuals library.',
  ].join('\n')

  try {
    const ticket = await prisma.supportTicket.create({
      data: {
        userId: session.userId,
        subject: `Manual contribution: ${parsed.data.title}`,
        messages: { create: { senderId: session.userId, body } },
      },
    })

    redirect(`/support/${ticket.id}`)
  } catch (error) {
    if (isDatabaseUnreachable(error)) {
      return { error: 'The submission database is not reachable right now.' }
    }
    throw error
  }
}