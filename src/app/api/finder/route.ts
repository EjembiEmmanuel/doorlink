import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { isDatabaseUnreachable } from '@/lib/db-errors'

// One endpoint drives all five finder steps. Each step only returns
// options that actually exist downstream, so the cascade can never lead
// to a dead end.
const querySchema = z.object({
  step: z.enum(['category', 'manufacturer', 'productLine', 'model', 'confirm']),
  categoryId: z.string().optional(),
  manufacturerId: z.string().optional(),
  productLineId: z.string().optional(),
  modelId: z.string().optional(),
})

export async function GET(request: Request) {
  const url = new URL(request.url)
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams))

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid finder request.' }, { status: 400 })
  }

  const { step, categoryId, manufacturerId, productLineId, modelId } = parsed.data

  try {
    if (step === 'category') {
      const categories = await prisma.category.findMany({
        where: { models: { some: {} } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      })
      return NextResponse.json({ step, options: categories })
    }

    if (step === 'manufacturer') {
      if (!categoryId) {
        return NextResponse.json({ error: 'categoryId is required for this step.' }, { status: 400 })
      }
      const manufacturers = await prisma.manufacturer.findMany({
        where: { models: { some: { categoryId } } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      })
      return NextResponse.json({ step, options: manufacturers })
    }

    if (step === 'productLine') {
      if (!categoryId || !manufacturerId) {
        return NextResponse.json(
          { error: 'categoryId and manufacturerId are required for this step.' },
          { status: 400 }
        )
      }
      const productLines = await prisma.productLine.findMany({
        where: { manufacturerId, models: { some: { categoryId } } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      })
      return NextResponse.json({ step, options: productLines })
    }

    if (step === 'model') {
      if (!categoryId || !manufacturerId) {
        return NextResponse.json(
          { error: 'categoryId and manufacturerId are required for this step.' },
          { status: 400 }
        )
      }
      const models = await prisma.model.findMany({
        where: {
          categoryId,
          manufacturerId,
          ...(productLineId ? { productLineId } : {}),
        },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      })
      return NextResponse.json({ step, options: models })
    }

    // step === 'confirm'
    if (!modelId) {
      return NextResponse.json({ error: 'modelId is required for this step.' }, { status: 400 })
    }
    const model = await prisma.model.findUnique({
      where: { id: modelId },
      include: {
        manufacturer: { select: { name: true } },
        category: { select: { name: true } },
        productLine: { select: { name: true } },
        specs: { orderBy: { sortOrder: 'asc' } },
        documents: { select: { id: true, title: true, kind: true } },
      },
    })
    if (!model) {
      return NextResponse.json({ error: 'Model not found.' }, { status: 404 })
    }
    return NextResponse.json({ step, model })
  } catch (error) {
    if (isDatabaseUnreachable(error)) {
      // Honest, not a fake empty catalogue and not a generic 500 — the
      // client renders this as <NotConnected /> instead of "try again".
      return NextResponse.json(
        {
          error: 'catalogue_not_connected',
          message: 'The product catalogue is not reachable right now.',
        },
        { status: 503 }
      )
    }
    throw error
  }
}
