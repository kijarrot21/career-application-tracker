/**
 * Centralized product feature availability.
 *
 * Pure, isomorphic configuration shared by navigation, route rendering, and
 * settings UI. Dormant implementations stay in the codebase; only the active
 * interface is gated. This module never reads a database or performs I/O.
 *
 * Note: Local AI is available, but its execution still uses the existing
 * server-side Credit Service reservation flow with the built-in welcome credit
 * allocation. No wallet UI, top-up, or payment is required to use it.
 */

export const FEATURE_AVAILABILITY_STATUSES = [
  "available",
  "in-development",
  "coming-soon",
  "temporarily-unavailable",
] as const;
export type FeatureAvailabilityStatus =
  (typeof FEATURE_AVAILABILITY_STATUSES)[number];

export const FEATURE_KEYS = [
  "localAI",
  "creditWallet",
  "payments",
  "cloudAI",
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export type FeatureStatusTone = "success" | "warning" | "info" | "neutral";

export interface FeatureAvailability {
  enabled: boolean;
  status: FeatureAvailabilityStatus;
  tone: FeatureStatusTone;
}

export const FEATURE_AVAILABILITY: Readonly<
  Record<FeatureKey, FeatureAvailability>
> = {
  localAI: { enabled: true, status: "available", tone: "success" },
  creditWallet: {
    enabled: false,
    status: "in-development",
    tone: "warning",
  },
  payments: { enabled: false, status: "in-development", tone: "warning" },
  cloudAI: { enabled: false, status: "coming-soon", tone: "info" },
};

export function getFeatureAvailability(feature: FeatureKey): FeatureAvailability {
  return FEATURE_AVAILABILITY[feature];
}

export function isFeatureEnabled(feature: FeatureKey): boolean {
  return FEATURE_AVAILABILITY[feature].enabled === true;
}
