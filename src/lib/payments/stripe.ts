import 'server-only'

import type {
  PaymentIntentRequest,
  PaymentIntentResult,
  PaymentProvider,
  PayoutRequest,
  PayoutResult,
  RefundRequest,
  RefundResult,
  SubscriptionCheckoutRequest,
  SubscriptionCheckoutResult,
  VerifiedWebhookEvent,
} from './types'
import { PaymentsNotConfiguredError } from './types'

/**
 * The Stripe adapter.
 *
 * This is the only file in the codebase that knows Stripe exists. It is
 * deliberately written as the *shape* of the integration rather than a
 * working one: the `stripe` SDK is not installed and no keys exist, and
 * installing an SDK we cannot call would add weight without adding
 * capability.
 *
 * Every method below documents the exact Stripe call that replaces it,
 * and throws `PaymentsNotConfiguredError` until then. Nothing fabricates
 * a successful response — a fake payment confirmation is the single most
 * dangerous thing this module could produce.
 *
 * ---------------------------------------------------------------------
 * TO CONNECT STRIPE
 * ---------------------------------------------------------------------
 *  1. `npm install stripe`
 *  2. Fill in, in `.env`:
 *       STRIPE_SECRET_KEY               sk_live_… / sk_test_…
 *       STRIPE_WEBHOOK_SECRET           whsec_…  (from the endpoint you
 *                                       register for /api/webhooks/stripe)
 *       NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  pk_…
 *       STRIPE_CONNECT_CLIENT_ID        ca_…     (only for worker payouts)
 *  3. Replace each `notConfigured()` below with the call named in its
 *     comment. The surrounding types do not change.
 *  4. Create the prices in Stripe and put their ids on
 *     `SubscriptionPlan.stripePriceId`. A plan without one stays
 *     unsubscribable, and the UI already says so.
 *
 * Nothing outside this file needs to change.
 * ---------------------------------------------------------------------
 */

function notConfigured(action: string): never {
  throw new PaymentsNotConfiguredError(action)
}

export function createStripeProvider(): PaymentProvider {
  return {
    name: 'stripe',

    // stripe.paymentIntents.create({
    //   amount, currency, description,
    //   application_fee_amount: request.applicationFeeCents,
    //   transfer_data: request.destinationAccountId
    //     ? { destination: request.destinationAccountId }
    //     : undefined,
    //   metadata: { reference: request.reference, ...request.metadata },
    // })
    async createPaymentIntent(_request: PaymentIntentRequest): Promise<PaymentIntentResult> {
      return notConfigured('take a payment')
    },

    // stripe.refunds.create({
    //   payment_intent: request.providerIntentId,
    //   amount: request.amountCents,
    //   reason: request.reason,
    // })
    async refund(_request: RefundRequest): Promise<RefundResult> {
      return notConfigured('issue a refund')
    },

    // stripe.transfers.create({
    //   amount, currency,
    //   destination: request.destinationAccountId,
    //   transfer_group: request.reference,
    // })
    async createPayout(_request: PayoutRequest): Promise<PayoutResult> {
      return notConfigured('pay a technician')
    },

    // stripe.checkout.sessions.create({
    //   mode: 'subscription',
    //   line_items: [{ price: request.providerPriceId, quantity: 1 }],
    //   customer_email: request.customerEmail,
    //   client_reference_id: request.userId,
    //   subscription_data: request.trialDays
    //     ? { trial_period_days: request.trialDays }
    //     : undefined,
    //   success_url: request.successUrl,
    //   cancel_url: request.cancelUrl,
    // })
    async createSubscriptionCheckout(
      _request: SubscriptionCheckoutRequest
    ): Promise<SubscriptionCheckoutResult> {
      return notConfigured('start a subscription')
    },

    // stripe.webhooks.constructEvent(rawBody, signatureHeader, process.env.STRIPE_WEBHOOK_SECRET)
    //
    // This one matters more than the rest. It is the only path by which a
    // Doorlink transaction is ever marked PAID, so it must verify the
    // signature and throw on failure rather than parsing the body and
    // hoping. Never replace it with JSON.parse.
    async verifyWebhook(_rawBody: string, _signatureHeader: string): Promise<VerifiedWebhookEvent> {
      return notConfigured('verify a webhook')
    },
  }
}
