import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  PRIORITY_LABELS,
  TRIAGE_LABELS,
  type JobPriority,
  type TriageStatus,
} from "@/lib/constants";
import { OUTCOME_LABELS, type Outcome } from "@/lib/domain/stages";
import { scoreBand } from "@/lib/domain/suitability";
import { cn } from "@/lib/utils";

type StageTone = "warning" | "primary" | "success" | "destructive" | "neutral";

const TONE_BADGE_VARIANT: Record<StageTone, BadgeProps["variant"]> = {
  warning: "warning",
  primary: "primary",
  success: "success",
  destructive: "destructive",
  neutral: "secondary",
};

const TONE_DOT_CLASS: Record<StageTone, string> = {
  warning: "bg-warning",
  primary: "bg-primary",
  success: "bg-success",
  destructive: "bg-destructive",
  neutral: "bg-subtle-foreground",
};

const COLOR_TO_TONE: Record<string, StageTone> = {
  slate: "warning",
  amber: "warning",
  orange: "warning",
  sky: "primary",
  blue: "primary",
  indigo: "primary",
  violet: "success",
  purple: "success",
  fuchsia: "success",
  teal: "success",
  emerald: "success",
  rose: "destructive",
  stone: "destructive",
  zinc: "neutral",
};

export function getStageTone(color: string, stageName?: string): StageTone {
  if (stageName) {
    const lower = stageName.toLowerCase();
    if (lower.includes("applied") || lower.includes("initial")) {
      return "primary";
    }
    if (
      lower.includes("interview") ||
      lower.includes("offer") ||
      lower.includes("hired") ||
      lower.includes("technical")
    ) {
      return "success";
    }
    if (
      lower.includes("review") ||
      lower.includes("screening") ||
      lower.includes("sourced") ||
      lower.includes("interested")
    ) {
      return "warning";
    }
    if (
      lower.includes("reject") ||
      lower.includes("archive") ||
      lower.includes("unsuccessful")
    ) {
      return "destructive";
    }
  }
  return COLOR_TO_TONE[color] ?? "primary";
}

export function getStageColorStyle(color: string, stageName?: string) {
  const tone = getStageTone(color, stageName);
  return {
    tone,
    dot: TONE_DOT_CLASS[tone],
    variant: TONE_BADGE_VARIANT[tone],
  };
}

export function StatusBadge({
  label,
  tone = "neutral",
  showDot = true,
  className,
}: {
  label: string;
  tone?: StageTone | "info";
  showDot?: boolean;
  className?: string;
}) {
  const variant: BadgeProps["variant"] =
    tone === "info" ? "info" : TONE_BADGE_VARIANT[tone];
  const dotClass =
    tone === "info" ? "bg-info" : TONE_DOT_CLASS[tone];

  return (
    <Badge variant={variant} className={className}>
      {showDot && (
        <span
          aria-hidden="true"
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass)}
        />
      )}
      {label}
    </Badge>
  );
}

export function StageBadge({
  name,
  color = "indigo",
  className,
}: {
  name: string;
  color?: string;
  className?: string;
}) {
  const style = getStageColorStyle(color, name);
  return (
    <StatusBadge
      label={name}
      tone={style.tone}
      showDot={true}
      className={className}
    />
  );
}

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const variantMap: Record<Outcome, BadgeProps["variant"]> = {
    active: "primary",
    successful: "success",
    unsuccessful: "destructive",
    withdrawn: "secondary",
    no_response: "warning",
  };
  return <Badge variant={variantMap[outcome]}>{OUTCOME_LABELS[outcome]}</Badge>;
}

export function TriageBadge({ status }: { status: TriageStatus }) {
  const variantMap: Record<TriageStatus, BadgeProps["variant"]> = {
    new: "secondary",
    interested: "warning",
    shortlisted: "primary",
    not_interested: "destructive",
    archived: "destructive",
  };
  return <Badge variant={variantMap[status]}>{TRIAGE_LABELS[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: JobPriority }) {
  const variantMap: Record<JobPriority, BadgeProps["variant"]> = {
    low: "secondary",
    medium: "warning",
    high: "destructive",
  };
  return (
    <Badge variant={variantMap[priority]}>
      {PRIORITY_LABELS[priority]} Priority
    </Badge>
  );
}

export function SuitabilityBadge({
  score,
}: {
  score: number | null | undefined;
}) {
  const band = scoreBand(score ?? null);
  const variantMap = {
    none: "secondary",
    low: "destructive",
    medium: "warning",
    high: "success",
  } as const;

  return (
    <Badge variant={variantMap[band]} className="tabular-nums">
      {score != null ? `${score}% Fit` : "Unscored"}
    </Badge>
  );
}

export function SampleBadge() {
  return (
    <Badge
      variant="warning"
      title="Demonstration record. Can be removed from Settings or the top banner."
      className="px-2 text-[10px] uppercase tracking-[0.04em]"
    >
      Sample
    </Badge>
  );
}
