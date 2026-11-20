import { describe, expect, it } from "vitest";
import {
  FEATURE_AVAILABILITY,
  FEATURE_AVAILABILITY_STATUSES,
  FEATURE_KEYS,
  getFeatureAvailability,
  isFeatureEnabled,
} from "@/lib/domain/feature-availability";
import {
  getLocalizedFeatureLabel,
  getLocalizedFeatureStatusLabel,
  findMissingTranslationKeys,
  MESSAGE_CATALOGS,
} from "@/lib/i18n";

describe("feature availability configuration", () => {
  it("declares exactly the four product features", () => {
    expect([...FEATURE_KEYS]).toEqual([
      "localAI",
      "creditWallet",
      "payments",
      "cloudAI",
    ]);
    expect(Object.keys(FEATURE_AVAILABILITY)).toEqual([...FEATURE_KEYS]);
  });

  it("keeps Local AI enabled and all dormant features disabled", () => {
    expect(isFeatureEnabled("localAI")).toBe(true);
    expect(isFeatureEnabled("creditWallet")).toBe(false);
    expect(isFeatureEnabled("payments")).toBe(false);
    expect(isFeatureEnabled("cloudAI")).toBe(false);
  });

  it("assigns the expected maturity status to every feature", () => {
    expect(getFeatureAvailability("localAI").status).toBe("available");
    expect(getFeatureAvailability("creditWallet").status).toBe(
      "in-development",
    );
    expect(getFeatureAvailability("payments").status).toBe("in-development");
    expect(getFeatureAvailability("cloudAI").status).toBe("coming-soon");
  });

  it("only uses declared statuses with a display tone", () => {
    for (const feature of FEATURE_KEYS) {
      const availability = getFeatureAvailability(feature);
      expect(FEATURE_AVAILABILITY_STATUSES).toContain(availability.status);
      expect(availability.tone).toBeTruthy();
    }
  });

  it("provides bilingual labels and statuses through the existing catalogs", () => {
    const enDict = MESSAGE_CATALOGS["en-US"] as unknown as Record<
      string,
      unknown
    >;
    const idDict = MESSAGE_CATALOGS["id-ID"] as unknown as Record<
      string,
      unknown
    >;
    expect(findMissingTranslationKeys(enDict, idDict)).toEqual([]);

    expect(getLocalizedFeatureLabel("localAI", "en-US")).toBe("Local AI");
    expect(getLocalizedFeatureLabel("localAI", "id-ID")).toBe("AI Lokal");
    expect(getLocalizedFeatureStatusLabel("available", "en-US")).toBe(
      "Available",
    );
    expect(getLocalizedFeatureStatusLabel("available", "id-ID")).toBe(
      "Tersedia",
    );
    expect(getLocalizedFeatureStatusLabel("in-development", "en-US")).toBe(
      "In Development",
    );
    expect(getLocalizedFeatureStatusLabel("in-development", "id-ID")).toBe(
      "Dalam Pengembangan",
    );
    expect(getLocalizedFeatureStatusLabel("coming-soon", "en-US")).toBe(
      "Coming Soon",
    );
    expect(getLocalizedFeatureStatusLabel("coming-soon", "id-ID")).toBe(
      "Segera Hadir",
    );
  });
});
