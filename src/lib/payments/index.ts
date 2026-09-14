import 'server-only'

import { isConnected } from '../integrations'
import { createStripeProvider } from './stripe'
import { PaymentsNotConfiguredError, type PaymentProvider } from './types'

export * from './types'

/**
 * The one way the rest of the application gets at a payment provider.
 *
 * `paymentProvider()` returns null when nothing is configured rather than
 * throwing, so a page can ask "can we take money?" without try/catch and
 * render an honest not-connected state instead. Code that has already
 * decided it must charge someone calls `requirePaymentProvider()`, which
 * throws the typed error.
 */
export function paymentProvider(): PaymentProvider | null {
  if (!isConnected('payments')) return null
  return createStripeProvider()
}

export function requirePaymentProvider(action: string): PaymentProvider {
  const provider = paymentProvider()
  if (!provider) throw new PaymentsNotConfiguredError(action)
  return provider
}

export function paymentsAvailable(): boolean {
  return isConnected('payments')
}
