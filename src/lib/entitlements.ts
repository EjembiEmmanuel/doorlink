import 'server-only'

import { SubscriptionStatus } from '@prisma/client'
import { prisma } from './prisma'
import { isDatabaseUnreachable } from './db-errors'

/**
 * Feature gating.
 *
 * The brief is explicit on two points that pull against each other:
 * Doorlink will be a paid app, *and* important core functionality must
 * not be arbitrarily locked until the business model is confirmed. So the
 * gate is built and wired, and it is switched off.
 *
 * Which features are premium lives in `PlatformSetting` under
 * `premium_features`, not in this file, so the decision can be made later
 * by an admin without a rebuild — the same reasoning as the commission
 * rate. Today that setting is absent, `premiumFeatures()` returns an
 * empty set, and every feature is available to everyone. Nothing is
 * behind a paywall that cannot yet be paid for.
 */

export const PREMIUM_FEATURES_SETTING_KEY = 'premium_features'

/** Every feature the gate knows about. Adding one here does not gate it. */
export const FEATURES = {
  MANUAL_SEARCH_ADVANCED: 'manual_search_advanced',
  SAVED_MANUALS: 'saved_manuals',
  SAVED_CONFIGURATIONS: 'saved_configurations',
  CONFIGURATOR_ADVANCED: 'configurator_advanced',
  PRIORITY_LEADS: 'priority_leads',
  ADVANCED_MATCHING: 'advanced_matching',
  JOB_TRACKING: 'job_tracking',
  ADVANCED_NOTIFICATIONS: 'advanced_notifications',
} as const

export type Feature = (typeof FEATURES)[keyof typeof FEATURES]

export const FEATURE_LABELS: Record<Feature, string> = {
  manual_search_advanced: 'Advanced manual search',
  saved_manuals: 'Saved manuals',
  saved_configurations: 'Saved door configurations',
  configurator_advanced: 'Full configurator',
  priority_leads: 'Early access to new jobs',
  advanced_matching: 'Advanced job matching',
  job_tracking: 'Job tracking',
  advanced_notifications: 'Advanced notifications',
}

/**
 * Which features currently require a subscription. Empty unless an admin
 * has set it — the default is "nothing is gated", which is the only
 * honest default while nobody can subscribe.
 */
export async function premiumFeatures(): Promise<Set<Feature>> {
  try {
    const setting = await prisma.platformSetting.findUnique({
      where: { key: PREMIUM_FEATURES_SETTING_KEY },
    })
    if (!setting || !Array.isArray(setting.value)) return new Set()

    const known = new Set<string>(Object.values(FEATURES))
    return new Set(
      (setting.value as unknown[]).filter(
        (value): value is Feature => typeof value === 'string' && known.has(value)
      )
    )
  } catch (error) {
    // A gate that fails open is the right failure here: the alternative
    // is locking paying users out of the product because a query timed
    // out.
    if (isDatabaseUnreachable(error)) return new Set()
    throw error
  }
}

export const ACTIVE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.ACTIVE,
  // Past due is still active access. Cutting someone off the moment a
  // card bounces, before the provider has finished retrying, loses
  // customers who were never actually trying to leave.
  SubscriptionStatus.PAST_DUE,
]

export async function activeSubscription(userId: string) {
  try {
    return await prisma.subscription.findFirst({
      where: { userId, status: { in: ACTIVE_SUBSCRIPTION_STATUSES } },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    })
  } catch (error) {
    if (isDatabaseUnreachable(error)) return null
    throw error
  }
}

export interface Entitlements {
  subscribed: boolean
  planName: string | null
  status: SubscriptionStatus | null
  /** Features that would need a subscription, whether or not this user has one. */
  gated: Set<Feature>
  has(feature: Feature): boolean
}

export async function entitlementsFor(userId: string | null): Promise<Entitlements> {
  const [gated, subscription] = await Promise.all([
    premiumFeatures(),
    userId ? activeSubscription(userId) : Promise.resolve(null),
  ])

  const subscribed = Boolean(subscription)

  return {
    subscribed,
    planName: subscription?.plan?.name ?? null,
    status: subscription?.status ?? null,
    gated,
    has(feature: Feature) {
      if (!gated.has(feature)) return true
      return subscribed
    },
  }
}
