"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { useTranslations } from "@/components/i18n/locale-provider";
import { Badge, Button, Card, SectionHeader } from "@/components/ui";
import { getProductTourState } from "@/lib/domain/product-tour";
import type { ProgressSnapshot } from "@/lib/domain/progress";
import type { OnboardingPreferencesResult } from "@/server/services/onboarding";
import {
  dismissOnboardingRemindersAction,
  restartProductTourAction,
  restartTutorialAction,
  resumeGuidedSetupAction,
} from "@/server/actions/onboarding";

export function OnboardingSettingsCard({
  onboarding,
  progress,
}: {
  onboarding: OnboardingPreferencesResult;
  progress: ProgressSnapshot;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { t } = useTranslations();
  const { state } = onboarding;
  const tour = getProductTourState(state);

  function run(task: () => Promise<unknown>, message: string) {
    startTransition(async () => {
      try {
        await task();
        toast.success(message);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not update onboarding",
        );
      }
    });
  }

  function displayList(
    values: readonly string[],
    keyPrefix: "section" | "stage",
  ) {
    if (values.length === 0) return t("onboardingSettings.none");
    return values
      .map((value) => t(`onboardingSettings.labels.${keyPrefix}.${value}`, value))
      .join(", ");
  }

  return (
    <Card padding="lg" className="space-y-4">
      <SectionHeader
        title={t("onboardingSettings.sectionTitle")}
        description={t("onboardingSettings.sectionDescription")}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-2 rounded-lg border border-border-subtle bg-surface-subtle/40 p-3">
          <p className="text-label-sm uppercase text-muted-foreground">
            {t("onboardingSettings.statusTitle")}
          </p>
          <StatusRow
            label={t("onboardingSettings.modeLabel")}
            value={t(`onboardingSettings.labels.mode.${state.mode}`, state.mode)}
          />
          <StatusRow
            label={t("onboardingSettings.guidedStartedLabel")}
            value={
              state.guidedSetupStarted
                ? t("onboardingSettings.yes")
                : t("onboardingSettings.no")
            }
          />
          <StatusRow
            label={t("onboardingSettings.positionLabel")}
            value={
              state.currentPosition
                ? t(`onboardingSettings.labels.section.${state.currentPosition}`, state.currentPosition)
                : t("onboardingSettings.none")
            }
          />
          <StatusRow
            label={t("onboardingSettings.completedSectionsLabel")}
            value={displayList(state.completedSections, "section")}
          />
          <StatusRow
            label={t("onboardingSettings.skippedSectionsLabel")}
            value={displayList(state.skippedSections, "section")}
          />
          <StatusRow
            label={t("onboardingSettings.tourActiveLabel")}
            value={
              tour.activeStepId
                ? t(`onboardingSettings.labels.tourStep.${tour.activeStepId}`, tour.activeStepId)
                : t("onboardingSettings.none")
            }
          />
          <StatusRow
            label={t("onboardingSettings.dismissedRemindersLabel")}
            value={String(state.dismissedReminders.length)}
          />
        </div>

        <div className="space-y-2 rounded-lg border border-primary/20 bg-primary-soft/40 p-3">
          <p className="text-label-sm uppercase text-muted-foreground">
            {t("onboardingSettings.progressTitle")}
          </p>
          <p className="text-metric-num text-foreground tabular-nums">
            {progress.overall.percentage}%
          </p>
          <p className="text-caption text-muted-foreground">
            {progress.overall.completedCount} /{" "}
            {progress.overall.totalApplicableStages}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {progress.completedStages.map((stage) => (
              <Badge key={stage} variant="success">
                {t(`onboardingSettings.labels.stage.${stage}`, stage)}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={isPending}
          onClick={() =>
            run(resumeGuidedSetupAction, t("onboardingSettings.resumeToast"))
          }
        >
          {t("onboardingSettings.resumeGuidedButton")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={isPending}
          onClick={() =>
            run(restartTutorialAction, t("onboardingSettings.restartGuidedToast"))
          }
        >
          {t("onboardingSettings.restartGuidedButton")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={isPending}
          onClick={() =>
            run(async () => {
              const result = await restartProductTourAction();
              window.dispatchEvent(new Event("product-tour:start"));
              return result;
            }, t("onboardingSettings.restartTourToast"))
          }
        >
          {t("onboardingSettings.restartTourButton")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() =>
            run(
              dismissOnboardingRemindersAction,
              t("onboardingSettings.dismissToast"),
            )
          }
        >
          {t("onboardingSettings.dismissRemindersButton")}
        </Button>
      </div>
    </Card>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 text-caption">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-full break-words text-right text-foreground">
        {value}
      </span>
    </div>
  );
}
