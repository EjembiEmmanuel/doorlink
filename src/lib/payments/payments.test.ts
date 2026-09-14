import { describe, expect, it, beforeEach, afterEach } from 'vitest'

/**
 * These tests exist for one reason: to make it impossible to
 * accidentally ship a payment provider that reports success without a
 * payment having happened. Every method must refuse while no provider is
 * configured, and the refusal must be the typed error rather than a
 * silently empty result.
 */

const KEYS = ['STRIPE_SECRET_KEY'] as const
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const key of KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

describe('the Stripe adapter', () => {
  it('refuses every operation rather than faking one', async () => {
    const { createStripeProvider } = await import('./stripe')
    const { isPaymentsNotConfigured } = await import('./types')
    const provider = createStripeProvider()

    const calls: Array<Promise<unknown>> = [
      provider.createPaymentIntent({
        amountCents: 50_000,
        currency: 'AUD',
        reference: 'DL-TXN-TEST',
        description: 'test',
        applicationFeeCents: 5_000,
      }),
      provider.refund({ providerIntentId: 'pi_test' }),
      provider.createPayout({
        amountCents: 45_000,
        currency: 'AUD',
        destinationAccountId: 'acct_test',
        reference: 'DL-PAY-TEST',
        description: 'test',
      }),
      provider.createSubscriptionCheckout({
        providerPriceId: 'price_test',
        customerEmail: 'a@example.com',
        userId: 'u1',
        successUrl: 'https://example.com/ok',
        cancelUrl: 'https://example.com/no',
      }),
      provider.verifyWebhook('{}', 't=1,v1=deadbeef'),
    ]

    for (const call of calls) {
      await expect(call).rejects.toSatisfy(isPaymentsNotConfigured)
    }
  })

  // The one that matters most: a webhook whose signature cannot be
  // checked must never come back as a verified event.
  it('never returns a verified event for an unverifiable webhook', async () => {
    const { createStripeProvider } = await import('./stripe')
    const provider = createStripeProvider()
    await expect(provider.verifyWebhook('{"type":"payment_intent.succeeded"}', 'nonsense')).rejects.toThrow()
  })
})
