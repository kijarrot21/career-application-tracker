"use client";

import {
  ArrowRight,
  CheckCircle2,
  Circle,
  CircleAlert,
  Clock3,
  Compass,
  ListChecks,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge, Button, Card, EmptyState, SectionHeader } from "@/components/ui";
import { GuidedSetupWizard } from "./guided-setup-wizard";
import type { RecommendationCategory } from "@/lib/domain/recommendations";
import type { StageCompletionState } from "@/lib/domain/progress";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  dismissOnboardingReminderAction,
  resumeGuidedSetupAction,
} from "@/server/actions/onboarding";
import type { getDashboardInsights } from "@/server/queries/dashboard-insights";

export const GETTING_STARTED_DISMISS_KEY = "dashboard:getting_started";
const MAX_SECONDARY_ACTIONS = 3;
const MAX_URGENT_ACTIONS = 4;

type DashboardInsights = Awaited<ReturnType<typeof getDashboardInsights>>;
type Action = DashboardInsights["actions"]["primary"];

const CATEGORY_LABELS: Record<RecommendationCategory, string> = {
  time_sensitive: "Time-sensitive",
  setup: "Setup",
  application_workflow: "Application workflow",
  maintenance: "Maintenance",
};

const STATE_VARIANTS: Record<
  StageCompletionState,
  "success" | "primary" | "secondary" | "info"
> = {
  complete: "success",
  incomplete: "primary",
  optional: "info",
  unavailable: "secondary",
};

function priorityVariant(priority: number) {
  if (priority === 1) return "warning" as const;
  if (priority === 2) return "primary" as const;
  if (priority === 3) return "info" as const;
  return "secondary" as const;
}

function ActionRow({ action }: { action: NonNullable<Action> }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-subtle bg-surface-subtle/40 px-3 py-2">
      <div className="min-w-0">
        <p className="text-caption font-semibold text-foreground">
          {action.title}
        </p>
        <p className="text-label-xs text-muted-foreground">
          {CATEGORY_LABELS[action.category]}
          {action.dueDate ? ` · Due ${formatDate(action.dueDate)}` : ""}
        </p>
      </div>
      <Button variant="ghost" size="sm" asChild>
        <Link href={action.targetRoute} aria-label={`Open ${action.title}`}>
          Open
          <ArrowRight className="h-3 w-3" />
        </Link>
      </Button>
    </li>
  );
}

export function DashboardGuidance({ insights }: { insights: DashboardInsights }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [wizardOpen, setWizardOpen] = useState(false);
  const { progress, actions, onboarding } = insights;
  const isDismissed = onboarding.state.dismissedReminders.includes(
    GETTING_STARTED_DISMISS_KEY,
  );

  const currentStage =
    progress.stages.find(
      (stage) =>
        stage.status !== "complete" && stage.status !== "unavailable",
    ) ?? null;
  const pendingStages = progress.stages.filter(
    (stage) => stage.status === "incomplete",
  );
  const optionalStages = progress.stages.filter(
    (stage) => stage.isOptional && stage.status !== "unavailable",
  );
  const primary = actions.primary;
  const urgent = actions.urgent
    .filter((action) => action.actionId !== primary?.actionId)
    .slice(0, MAX_URGENT_ACTIONS);
  const secondary = actions.secondary.slice(0, MAX_SECONDARY_ACTIONS);

  function runAction(task: () => Promise<unknown>, message: string) {
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

  function handleResume() {
    startTransition(async () => {
      try {
        await resumeGuidedSetupAction();
        toast.success("Guided setup is ready to resume.");
        router.refresh();
        setWizardOpen(true);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not resume guided setup",
        );
      }
    });
  }

  return (
    <section
      aria-label="Getting started and recommended next actions"
      className="mt-2 grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12 lg:gap-6"
    >
      {!isDismissed && (
        <Card padding="lg" className="lg:col-span-5" data-tour="getting-started">
          <SectionHeader
            icon={Compass}
            title="Getting Started"
            description="Progress comes from your recorded data, not tutorial clicks."
            actions={
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={isPending}
                aria-label="Dismiss getting started progress"
                onClick={() =>
                  runAction(
                    () =>
                      dismissOnboardingReminderAction(
                        GETTING_STARTED_DISMISS_KEY,
                      ),
                    "Getting started widget dismissed.",
                  )
                }
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            }
          />

          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-metric-num text-foreground tabular-nums">
                {progress.overall.percentage}%
              </p>
              <p className="text-caption text-muted-foreground">
                {progress.overall.completedCount} of{" "}
                {progress.overall.totalApplicableStages} applicable stages done
              </p>
            </div>
            <Badge variant="primary" className="whitespace-nowrap">
              <ListChecks className="h-3 w-3" />
              {progress.overall.completedCount} complete
            </Badge>
          </div>

          <div
            role="progressbar"
            aria-label="Getting started progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.overall.percentage}
            className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-subtle"
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress.overall.percentage}%` }}
            />
          </div>

          <dl className="mt-4 space-y-2 text-caption">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-muted-foreground">Current stage</dt>
              <dd>
                {currentStage ? (
                  <Badge variant={STATE_VARIANTS[currentStage.status]}>
                    {currentStage.label}
                  </Badge>
                ) : (
                  <Badge variant="success">
                    <CheckCircle2 className="h-3 w-3" />
                    All stages complete
                  </Badge>
                )}
              </dd>
            </div>
            <div className="space-y-2">
              <dt className="text-label-sm uppercase text-muted-foreground">
                Pending checklist
              </dt>
              <dd>
                {pendingStages.length === 0 ? (
                  <p className="text-foreground">No required stages pending</p>
                ) : (
                  <ul className="space-y-1.5">
                    {pendingStages.slice(0, 5).map((stage) => (
                      <li
                        key={stage.key}
                        className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-subtle/40 px-2.5 py-2"
                      >
                        <Circle
                          aria-hidden="true"
                          className="h-3.5 w-3.5 shrink-0 text-primary-text"
                        />
                        <span className="min-w-0 flex-1 text-foreground">
                          {stage.label}
                        </span>
                        <span className="text-label-xs text-muted-foreground">
                          Required
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>
            <div className="space-y-2">
              <dt className="text-label-sm uppercase text-muted-foreground">
                Optional checklist
              </dt>
              <dd>
                {optionalStages.length === 0 ? (
                  <p className="text-foreground">No optional stages</p>
                ) : (
                  <ul className="space-y-1.5">
                    {optionalStages.map((stage) => {
                      const done = stage.status === "complete";
                      return (
                        <li
                          key={stage.key}
                          className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-subtle/40 px-2.5 py-2"
                        >
                          {done ? (
                            <CheckCircle2
                              aria-hidden="true"
                              className="h-3.5 w-3.5 shrink-0 text-success-on-soft"
                            />
                          ) : (
                            <Circle
                              aria-hidden="true"
                              className="h-3.5 w-3.5 shrink-0 text-subtle-foreground"
                            />
                          )}
                          <span className="min-w-0 flex-1 text-foreground">
                            {stage.label}
                          </span>
                          <span className="text-label-xs text-muted-foreground">
                            {done ? "Done" : "Optional"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </dd>
            </div>
            {progress.unavailableStages.length > 0 && (
              <div className="flex flex-wrap items-start justify-between gap-2">
                <dt className="text-muted-foreground">Unavailable</dt>
                <dd className="flex max-w-full flex-wrap justify-end gap-1.5">
                  {progress.stages
                    .filter((stage) =>
                      progress.unavailableStages.includes(stage.key),
                    )
                    .map((stage) => (
                      <Badge key={stage.key} variant="secondary">
                        {stage.label}
                      </Badge>
                    ))}
                </dd>
              </div>
            )}
          </dl>

          <Button
            variant="soft"
            size="sm"
            className="mt-5 w-full sm:w-auto"
            disabled={isPending}
            onClick={handleResume}
          >
            Resume Guided Setup
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Card>
      )}

      <Card
        padding="lg"
        className={cn(isDismissed ? "lg:col-span-12" : "lg:col-span-7")}
        data-tour="next-best-action"
      >
        <SectionHeader
          icon={CircleAlert}
          title="Next Best Action"
          description="Ranked from your current records and deadlines."
          badge={
            actions.urgent.length > 0 ? (
              <Badge variant="destructive">
                {actions.urgent.length} urgent
              </Badge>
            ) : undefined
          }
        />

        {primary ? (
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary-soft/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={priorityVariant(primary.priority)}>
                Priority {primary.priority}
              </Badge>
              <Badge variant="outline">{CATEGORY_LABELS[primary.category]}</Badge>
              {primary.dueDate && (
                <span className="text-label-xs text-muted-foreground">
                  <Clock3 className="mr-1 inline h-3 w-3" />
                  Due {formatDate(primary.dueDate)}
                </span>
              )}
            </div>
            <h3 className="mt-2 text-card-title text-foreground">
              {primary.title}
            </h3>
            <p className="mt-1 text-caption text-muted-foreground">
              {primary.description}
            </p>
            <p className="mt-2 text-caption font-medium text-primary-on-soft">
              {primary.reason}
            </p>
            <Button variant="primary" size="sm" className="mt-4" asChild>
              <Link href={primary.targetRoute}>
                Open action
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        ) : (
          <EmptyState
            className="mt-4 py-8"
            icon={CheckCircle2}
            title="Nothing needs your attention"
            description={actions.emptyStateReason ?? "You are all caught up."}
            action={
              <Button variant="secondary" size="sm" asChild>
                <Link href="/jobs">Explore jobs</Link>
              </Button>
            }
          />
        )}

        {urgent.length > 0 && (
          <div className="mt-5">
            <p className="text-label-sm uppercase text-warning-on-soft">
              Urgent actions
            </p>
            <ul className="mt-2 space-y-2">
              {urgent.map((action) => (
                <ActionRow key={action.actionId} action={action} />
              ))}
            </ul>
          </div>
        )}

        {secondary.length > 0 && (
          <div className="mt-5">
            <p className="text-label-sm uppercase text-muted-foreground">
              Also relevant
            </p>
            <ul className="mt-2 space-y-2">
              {secondary.map((action) => (
                <ActionRow key={action.actionId} action={action} />
              ))}
            </ul>
          </div>
        )}
      </Card>

      <GuidedSetupWizard
        insights={insights}
        open={wizardOpen}
        onOpenChange={setWizardOpen}
      />
    </section>
  );
}
