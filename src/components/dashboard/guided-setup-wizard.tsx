"use client";

import { ArrowRight, CheckCircle2, CircleAlert, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import {
  getStepBusinessState,
  isStepRouteAvailable,
  resolveGuidedSetupStep,
} from "@/lib/domain/guided-setup";
import type { NextBestActionResult } from "@/lib/domain/recommendations";
import { cn } from "@/lib/utils";
import {
  advanceGuidedSetupAction,
  restartTutorialAction,
  skipTutorialSectionAction,
  updateTutorialPositionAction,
} from "@/server/actions/onboarding";
import type { getDashboardInsights } from "@/server/queries/dashboard-insights";

type DashboardInsights = Awaited<ReturnType<typeof getDashboardInsights>>;

export function GuidedSetupWizard({
  insights,
  open,
  onOpenChange,
}: {
  insights: DashboardInsights;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { progress, workflow, actions, onboarding } = insights;
  const step = resolveGuidedSetupStep({
    progress,
    recommendedNextStages: workflow.recommendedNextStages,
    onboarding: onboarding.state,
  });
  const businessState = step
    ? getStepBusinessState(progress, step.section)
    : "complete";
  const routeAvailable = step ? isStepRouteAvailable(step) : false;
  const tutorialComplete = step
    ? onboarding.state.completedSections.includes(step.section)
    : false;
  const urgent: NextBestActionResult["primary"] =
    actions.primary?.priority === 1 ? actions.primary : null;

  function run(task: () => Promise<unknown>, message: string, keepOpen = false) {
    startTransition(async () => {
      try {
        await task();
        toast.success(message);
        router.refresh();
        if (!keepOpen) onOpenChange(false);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not update guided setup",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Guided Setup</DialogTitle>
          <DialogDescription>
            Tutorial progress is separate from actual completion. Steps follow
            your recorded data.
          </DialogDescription>
        </DialogHeader>

        {step ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary">
                {step.moduleLabel}
              </Badge>
              <Badge
                variant={
                  businessState === "complete"
                    ? "success"
                    : businessState === "unavailable"
                      ? "secondary"
                      : "warning"
                }
              >
                {businessState === "complete"
                  ? "Business step complete"
                  : businessState === "unavailable"
                    ? "Module unavailable"
                    : "Business step not complete"}
              </Badge>
              {tutorialComplete && (
                <Badge variant="info">Tutorial section viewed</Badge>
              )}
            </div>

            <div>
              <h3 className="text-card-title text-foreground">{step.title}</h3>
              <p className="mt-1 text-caption text-muted-foreground">
                {step.description}
              </p>
            </div>

            <div className="rounded-lg border border-border-subtle bg-surface-subtle/40 p-3">
              <p className="text-label-sm uppercase text-muted-foreground">
                Expected outcome
              </p>
              <p className="mt-1 text-caption text-foreground">
                {step.expectedOutcome}
              </p>
            </div>

            {!routeAvailable ? (
              <p
                role="status"
                className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-soft p-3 text-caption text-warning-on-soft"
              >
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                This destination is unavailable in this installation. You can
                continue or skip this tutorial section.
              </p>
            ) : (
              <Button variant="soft" size="sm" asChild>
                <Link href={step.targetRoute} aria-label={`Open ${step.moduleLabel}`}>
                  Open {step.moduleLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}

            {urgent && (
              <div className="rounded-lg border border-warning-border bg-warning-soft/50 p-3">
                <p className="text-label-sm uppercase text-warning-on-soft">
                  Urgent action available
                </p>
                <p className="mt-1 text-caption font-medium text-foreground">
                  {urgent.title}
                </p>
                <p className="mt-1 text-caption text-muted-foreground">
                  {urgent.reason}
                </p>
                {isStepRouteAvailable({
                  section: step.section,
                  stage: step.stage,
                  title: urgent.title,
                  description: urgent.description,
                  expectedOutcome: urgent.completionCondition,
                  moduleLabel: urgent.title,
                  targetRoute: urgent.targetRoute,
                }) && (
                  <Button variant="warning" size="sm" className="mt-2" asChild>
                    <Link href={urgent.targetRoute}>
                      Review urgent action
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  run(
                    () => updateTutorialPositionAction(step.section),
                    "Tutorial position saved for later.",
                  )
                }
              >
                Resume later
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  run(
                    () => skipTutorialSectionAction(step.section),
                    "Tutorial section skipped.",
                    true,
                  )
                }
              >
                Skip tutorial section
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={isPending}
                className={cn(isPending && "opacity-70")}
                onClick={() =>
                  run(
                    () => advanceGuidedSetupAction(step.section),
                    "Tutorial section completed.",
                    true,
                  )
                }
              >
                Continue
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-success-on-soft">
              <CheckCircle2 className="h-5 w-5" />
              <p className="text-card-title">No tutorial step is pending</p>
            </div>
            <p className="text-caption text-muted-foreground">
              Completed stages were detected from your records. Restarting the
              tutorial only resets tutorial state, never application data.
            </p>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Exit
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  run(restartTutorialAction, "Tutorial restarted.", true)
                }
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restart tutorial
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
