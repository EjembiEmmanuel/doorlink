// The single place that decides whether a feature is actually live.
// Everything else checks this and renders <NotConnected /> when the
// answer is no — nothing in the UI pretends to be connected.
export type IntegrationKey = 'auth' | 'storage' | 'payments' | 'email' | 'push' | 'ai'

interface IntegrationStatus {
  enabled: boolean
  reason?: string
}

function configured(...vars: Array<string | undefined>): boolean {
  return vars.every((value) => !!value && value.length > 0)
}

export const integrations: Record<IntegrationKey, IntegrationStatus> = {
  auth: configured(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    ? { enabled: true }
    : {
        enabled: false,
        reason: 'Supabase auth is not configured. The dev session provider is active instead.',
      },
  storage: configured(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_STORAGE_BUCKET
  )
    ? { enabled: true }
    : { enabled: false, reason: 'Supabase storage is not configured. Document uploads are disabled.' },
  payments: configured(process.env.STRIPE_SECRET_KEY)
    ? { enabled: true }
    : { enabled: false, reason: 'Stripe is not configured. Checkout stays in demo mode.' },
  email: configured(process.env.RESEND_API_KEY)
    ? { enabled: true }
    : { enabled: false, reason: 'Resend is not configured. No transactional email is sent.' },
  // Web push needs a VAPID key pair. There is no provider to sign up
  // to — the keys are generated once — but until they exist the service
  // worker has nothing to subscribe to, so nothing may claim a push was
  // sent.
  push: configured(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)
    ? { enabled: true }
    : { enabled: false, reason: 'No VAPID keys are configured. No push notification is sent.' },
  ai: configured(process.env.ANTHROPIC_API_KEY)
    ? { enabled: true }
    : { enabled: false, reason: 'No AI provider is configured.' },
}

export function isConnected(key: IntegrationKey): boolean {
  return integrations[key].enabled
}

export const isDemoMode = process.env.DOORLINK_DEMO_MODE !== 'false'
