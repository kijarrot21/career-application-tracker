import type { AppDb } from "@/db";
import { aiCreditPricing, creditPackages } from "@/db/schema";
import {
  DEFAULT_CREDIT_PACKAGES,
  DEFAULT_CREDIT_PRICING,
} from "@/lib/domain/credits";

/**
 * Seeds default configurable AI task pricing rows and IDR/USD credit packages.
 * Idempotent: existing customized DB pricing rows are preserved (`onConflictDoNothing`).
 */
export async function seedCreditCatalog(db: AppDb): Promise<void> {
  for (const row of DEFAULT_CREDIT_PRICING) {
    await db
      .insert(aiCreditPricing)
      .values({
        pricingKey: row.pricingKey,
        taskType: row.taskType,
        label: row.label,
        description: row.description,
        creditCost: row.creditCost,
        chargeLocalRuns: true,
        isActive: true,
        sortOrder: row.sortOrder,
      })
      .onConflictDoNothing();
  }

  for (const pkg of DEFAULT_CREDIT_PACKAGES) {
    await db
      .insert(creditPackages)
      .values({
        packageKey: pkg.packageKey,
        name: pkg.name,
        description: pkg.description,
        credits: pkg.credits,
        bonusCredits: pkg.bonusCredits,
        priceIdr: pkg.priceIdr,
        priceUsdCents: pkg.priceUsdCents,
        badgeText: pkg.badgeText,
        isPopular: pkg.isPopular,
        isActive: true,
        sortOrder: pkg.sortOrder,
      })
      .onConflictDoNothing();
  }
}
