'use server'

import { z } from 'zod'
import { SpringCalcMethod, SpringSystemType } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'
import { makeReference } from '@/lib/reference'

export type SaveState = { error?: string; reference?: string }

// Every number is optional and every one is bounded. The client already
// validated, but a server action is a public endpoint — what arrives
// here is whatever somebody chose to post.
const finite = z
  .number()
  .finite()
  .nullable()
  .optional()
  .transform((v) => (v == null || !Number.isFinite(v) ? null : v))

const schema = z.object({
  assetId: z.string().min(1).nullable(),
  doorLabel: z.string().trim().max(160).nullable(),
  springType: z.nativeEnum(SpringSystemType),
  method: z.nativeEnum(SpringCalcMethod),
  springCount: z.number().int().min(1).max(6),
  liftType: z.string().max(20).nullable(),
  doorWeightLb: finite,
  doorHeightIn: finite,
  drumDiameterIn: finite,
  wireDiameterIn: finite,
  insideDiameterIn: finite,
  bodyLengthIn: finite,
  preloadTurns: finite,
  ipptPerSpring: finite,
  turns: finite,
  pullPerSpringLb: finite,
  lifeYears: finite,
  warnings: z.array(z.object({ code: z.string(), message: z.string() })).max(20),
})

export async function saveCalculation(input: unknown): Promise<SaveState> {
  const session = await getSession()
  if (!session) return { error: 'Sign in to save a calculation.' }

  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { error: 'That calculation could not be saved — some of the values were not usable.' }
  }
  const data = parsed.data

  try {
    // An asset id from the client is a claim, not a fact. Confirmed
    // against what this user's organisation actually owns before it is
    // stored, so a posted id cannot attach a calculation to somebody
    // else's door.
    let assetId: string | null = null
    if (data.assetId) {
      const asset = await prisma.asset.findFirst({
        where: {
          id: data.assetId,
          organization: { members: { some: { userId: session.userId } } },
        },
        select: { id: true },
      })
      if (!asset) {
        return { error: 'That door is not one you can save against.' }
      }
      assetId = asset.id
    }

    const saved = await prisma.springCalculation.create({
      data: {
        reference: makeReference('SPR'),
        performedById: session.userId,
        assetId,
        doorLabel: data.doorLabel,
        springType: data.springType,
        method: data.method,
        springCount: data.springCount,
        liftType: data.liftType,
        doorWeightLb: data.doorWeightLb,
        doorHeightIn: data.doorHeightIn,
        drumDiameterIn: data.drumDiameterIn,
        wireDiameterIn: data.wireDiameterIn,
        insideDiameterIn: data.insideDiameterIn,
        bodyLengthIn: data.bodyLengthIn,
        preloadTurns: data.preloadTurns,
        ipptPerSpring: data.ipptPerSpring,
        turns: data.turns,
        pullPerSpringLb: data.pullPerSpringLb,
        lifeYears: data.lifeYears,
        warnings: data.warnings,
      },
      select: { reference: true },
    })

    return { reference: saved.reference }
  } catch (error) {
    if (isDatabaseUnreachable(error)) {
      return { error: "Can't reach the database right now. Your result is still on screen." }
    }
    throw error
  }
}
