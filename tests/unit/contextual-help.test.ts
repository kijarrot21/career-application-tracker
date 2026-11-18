import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { HELP_MODULES, HELP_MODULE_KEYS } from "@/lib/domain/contextual-help";
import { isRouteAvailable } from "@/lib/domain/recommendations";
import { MESSAGE_CATALOGS, translate } from "@/lib/i18n";
import { SUPPORTED_LOCALES } from "@/lib/i18n/types";

describe("contextual help registry", () => {
  it("lists only implemented modules with verified routes", () => {
    expect(HELP_MODULES).toHaveLength(HELP_MODULE_KEYS.length);
    for (const entry of HELP_MODULES) {
      expect(isRouteAvailable(entry.route)).toBe(true);
      expect(isRouteAvailable(entry.nextRoute)).toBe(true);
    }
  });

  it("renders localized help text for every module and locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(
        translate(locale, "help.button"),
      ).not.toBe("help.button");
      for (const key of HELP_MODULE_KEYS) {
        for (const field of ["title", "purpose", "fields", "outcome", "stage", "next"]) {
          const value = translate(locale, `help.modules.${key}.${field}`);
          expect(value.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("has matching onboarding settings keys in both catalogs", () => {
    const keys = [
      "sectionTitle",
      "resumeGuidedButton",
      "restartGuidedButton",
      "restartTourButton",
      "dismissRemindersButton",
      "dismissToast",
    ];
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of keys) {
        expect(translate(locale, `onboardingSettings.${key}`)).not.toBe(
          `onboardingSettings.${key}`,
        );
      }
      expect(MESSAGE_CATALOGS[locale].help.modules.careerProfile.title).toBeTruthy();
      expect(
        translate(locale, "onboardingSettings.labels.mode.guided"),
      ).not.toBe("onboardingSettings.labels.mode.guided");
      expect(
        translate(locale, "onboardingSettings.labels.section.career_profile"),
      ).not.toBe("onboardingSettings.labels.section.career_profile");
    }
  });

  it("wires help into each existing module page", () => {
    const files = [
      "src/components/profile/career-profile-client.tsx",
      "src/components/cv-studio/cv-studio-client.tsx",
      "src/components/documents/documents-client.tsx",
      "src/components/jobs/jobs-list-client.tsx",
      "src/components/jobs/shortlist-client.tsx",
      "src/components/applications/applications-view-client.tsx",
      "src/components/interviews/interviews-client.tsx",
      "src/components/archive/archive-list-client.tsx",
    ];
    for (const file of files) {
      expect(readFileSync(resolve(process.cwd(), file), "utf8")).toContain(
        "<ContextualHelp",
      );
    }
  });
});
