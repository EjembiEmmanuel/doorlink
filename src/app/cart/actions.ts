'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { isDatabaseUnreachable } from '@/lib/db-errors'

export type CartActionState = { error?: string }

async function requireSignedIn() {
  const session = await getSession()
  if (!session) throw new Error('Sign in to use the cart.')
  return session
}

// A user's cart is created lazily on first add — there is no seed-time
// Cart row for every user.
async function getOrCreateCart(userId: string) {
  return prisma.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
  })
}

const addSchema = z.object({
  listingId: z.string().trim().min(1),
})

export async function addToCartAction(
  _prevState: CartActionState,
  formData: FormData
): Promise<CartActionState> {
  let session
  try {
    session = await requireSignedIn()
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sign in to use the cart.' }
  }

  const parsed = addSchema.safeParse({ listingId: formData.get('listingId') })
  if (!parsed.success) return { error: 'Missing listing.' }

  try {
    const listing = await prisma.listing.findUnique({ where: { id: parsed.data.listingId } })
    if (!listing || listing.status !== 'ACTIVE') {
      return { error: 'This listing is no longer available.' }
    }

    const cart = await getOrCreateCart(session.userId)
    await prisma.cartItem.upsert({
      where: { cartId_listingId: { cartId: cart.id, listingId: listing.id } },
      update: { quantity: { increment: 1 } },
      create: { cartId: cart.id, listingId: listing.id, quantity: 1 },
    })
  } catch (error) {
    if (isDatabaseUnreachable(error)) return { error: 'The cart isn’t reachable right now.' }
    throw error
  }

  revalidatePath('/cart')
  revalidatePath('/marketplace')
  return {}
}

const quantitySchema = z.object({
  itemId: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1.').max(99, 'Quantity is capped at 99.'),
})

export async function updateCartItemAction(
  _prevState: CartActionState,
  formData: FormData
): Promise<CartActionState> {
  let session
  try {
    session = await requireSignedIn()
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sign in to use the cart.' }
  }

  const parsed = quantitySchema.safeParse({
    itemId: formData.get('itemId'),
    quantity: formData.get('quantity'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Enter a valid quantity.' }
  }

  try {
    const item = await prisma.cartItem.findUnique({ where: { id: parsed.data.itemId }, include: { cart: true } })
    if (!item || item.cart.userId !== session.userId) {
      return { error: 'Item not found in your cart.' }
    }

    await prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity: parsed.data.quantity },
    })
  } catch (error) {
    if (isDatabaseUnreachable(error)) return { error: 'The cart isn’t reachable right now.' }
    throw error
  }

  revalidatePath('/cart')
  return {}
}

const itemIdSchema = z.object({ itemId: z.string().trim().min(1) })

export async function removeCartItemAction(
  _prevState: CartActionState,
  formData: FormData
): Promise<CartActionState> {
  let session
  try {
    session = await requireSignedIn()
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Sign in to use the cart.' }
  }

  const parsed = itemIdSchema.safeParse({ itemId: formData.get('itemId') })
  if (!parsed.success) return { error: 'Missing item.' }

  try {
    const item = await prisma.cartItem.findUnique({ where: { id: parsed.data.itemId }, include: { cart: true } })
    if (!item || item.cart.userId !== session.userId) {
      return { error: 'Item not found in your cart.' }
    }

    await prisma.cartItem.delete({ where: { id: item.id } })
  } catch (error) {
    if (isDatabaseUnreachable(error)) return { error: 'The cart isn’t reachable right now.' }
    throw error
  }

  revalidatePath('/cart')
  return {}
}
