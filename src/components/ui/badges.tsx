import {
  PRIORITY_LABELS,
  TRIAGE_LABELS,
  type JobPriority,
  type TriageStatus,
} from "@/lib/constants";
import { OUTCOME_LABELS, type Outcome } from "@/lib/domain/stages";
import { scoreBand } from "@/lib/domain/suitability";
import { cn } from "@/lib/utils";

const STAGE_COLOR_STYLES: Record<string, { badge: string; dot: string }> = {
  // Stage: In Review / Lead / Screening (Warm Tertiary Gold / Amber)
  slate: {
    badge:
      "bg-[#ffdead]/80 text-[#5d4211] border-[#e8c084]/60 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    dot: "bg-[#8f6f3b]",
  },
  amber: {
    badge:
      "bg-[#ffdead]/80 text-[#5d4211] border-[#e8c084]/60 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    dot: "bg-[#8f6f3b]",
  },
  orange: {
    badge:
      "bg-[#ffdead]/80 text-[#5d4211] border-[#e8c084]/60 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    dot: "bg-[#8f6f3b]",
  },

  // Stage: Applied / Initial Contact (Secondary Emerald Container)
  sky: {
    badge:
      "bg-[#c0edcf] text-[#005232] border-[#a5d1b4]/60 dark:bg-[#006a42]/25 dark:text-[#86f9ba] dark:border-[#006a42]/40",
    dot: "bg-[#008655]",
  },
  blue: {
    badge:
      "bg-[#c0edcf] text-[#005232] border-[#a5d1b4]/60 dark:bg-[#006a42]/25 dark:text-[#86f9ba] dark:border-[#006a42]/40",
    dot: "bg-[#008655]",
  },
  indigo: {
    badge:
      "bg-[#c0edcf] text-[#005232] border-[#a5d1b4]/60 dark:bg-[#006a42]/25 dark:text-[#86f9ba] dark:border-[#006a42]/40",
    dot: "bg-[#006a42]",
  },

  // Stage: Active Interview / Offer (High-Emphasis Primary Emerald)
  violet: {
    badge:
      "bg-[#86f9ba]/75 text-[#002111] border-[#69dca0]/70 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    dot: "bg-[#006a42]",
  },
  purple: {
    badge:
      "bg-[#86f9ba]/75 text-[#002111] border-[#69dca0]/70 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    dot: "bg-[#006a42]",
  },
  fuchsia: {
    badge:
      "bg-[#86f9ba]/75 text-[#002111] border-[#69dca0]/70 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    dot: "bg-[#006a42]",
  },
  teal: {
    badge:
      "bg-[#86f9ba]/75 text-[#002111] border-[#69dca0]/70 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    dot: "bg-[#006a42]",
  },
  emerald: {
    badge:
      "bg-[#86f9ba]/75 text-[#002111] border-[#69dca0]/70 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    dot: "bg-[#006a42]",
  },

  // Stage: Archived / Rejection (Error Container)
  rose: {
    badge:
      "bg-[#ffdad6] text-[#93000a] border-[#ba1a1a]/25 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
    dot: "bg-[#ba1a1a]",
  },
  zinc: {
    badge:
      "bg-[#e3eae3] text-[#3e4a41] border-[#bdcabf]/60 dark:bg-[#1d2b23] dark:text-[#b7c6ba] dark:border-[#2d3d33]",
    dot: "bg-[#6e7a71]",
  },
  stone: {
    badge:
      "bg-[#ffdad6] text-[#93000a] border-[#ba1a1a]/25 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
    dot: "bg-[#ba1a1a]",
  },
};

export function getStageColorStyle(color: string, stageName?: string) {
  if (stageName) {
    const lower = stageName.toLowerCase();
    if (lower.includes("applied") || lower.includes("initial")) {
      return STAGE_COLOR_STYLES.indigo;
    }
    if (
      lower.includes("interview") ||
      lower.includes("offer") ||
      lower.includes("hired") ||
      lower.includes("technical")
    ) {
      return STAGE_COLOR_STYLES.emerald;
    }
    if (
      lower.includes("review") ||
      lower.includes("screening") ||
      lower.includes("sourced") ||
      lower.includes("interested")
    ) {
      return STAGE_COLOR_STYLES.amber;
    }
    if (
      lower.includes("reject") ||
      lower.includes("archive") ||
      lower.includes("unsuccessful")
    ) {
      return STAGE_COLOR_STYLES.rose;
    }
  }
  return STAGE_COLOR_STYLES[color] ?? STAGE_COLOR_STYLES.indigo;
}

const PILL_BASE =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[2px] text-[11px] leading-[14px] font-semibold tracking-[0.03em]";

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
    <span className={cn(PILL_BASE, style.badge, className)}>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", style.dot)} />
      {name}
    </span>
  );
}

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const styles: Record<Outcome, string> = {
    active:
      "bg-[#c0edcf] text-[#005232] border-[#a5d1b4]/60 dark:bg-[#006a42]/25 dark:text-[#86f9ba] dark:border-[#006a42]/40",
    successful:
      "bg-[#86f9ba]/80 text-[#002111] border-[#69dca0]/70 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
    unsuccessful:
      "bg-[#ffdad6] text-[#93000a] border-[#ba1a1a]/25 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
    withdrawn:
      "bg-[#e3eae3] text-[#3e4a41] border-[#bdcabf]/60 dark:bg-[#1d2b23] dark:text-[#b7c6ba] dark:border-[#2d3d33]",
    no_response:
      "bg-[#ffdead]/80 text-[#5d4211] border-[#e8c084]/60 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
  };
  return (
    <span className={cn(PILL_BASE, styles[outcome])}>
      {OUTCOME_LABELS[outcome]}
    </span>
  );
}

export function TriageBadge({ status }: { status: TriageStatus }) {
  const styles: Record<TriageStatus, string> = {
    new: "bg-[#e3eae3] text-[#3e4a41] border-[#bdcabf]/60 dark:bg-[#1d2b23] dark:text-[#b7c6ba] dark:border-[#2d3d33]",
    interested:
      "bg-[#ffdead]/80 text-[#5d4211] border-[#e8c084]/60 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
    shortlisted:
      "bg-[#c0edcf] text-[#005232] border-[#a5d1b4]/60 dark:bg-[#006a42]/25 dark:text-[#86f9ba] dark:border-[#006a42]/40",
    not_interested:
      "bg-[#ffdad6] text-[#93000a] border-[#ba1a1a]/25 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
    archived:
      "bg-[#ffdad6] text-[#93000a] border-[#ba1a1a]/25 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
  };
  return (
    <span className={cn(PILL_BASE, styles[status])}>
      {TRIAGE_LABELS[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: JobPriority }) {
  const styles: Record<JobPriority, string> = {
    low: "bg-[#e3eae3] text-[#3e4a41] border-[#bdcabf]/60 dark:bg-[#1d2b23] dark:text-[#9fb0a3] dark:border-[#2d3d33]",
    medium:
      "bg-[#ffdead]/80 text-[#5d4211] border-[#e8c084]/60 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
    high: "bg-[#ffdad6] text-[#93000a] border-[#ba1a1a]/25 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
  };
  return (
    <span className={cn(PILL_BASE, styles[priority])}>
      {PRIORITY_LABELS[priority]} Priority
    </span>
  );
}

export function SuitabilityBadge({
  score,
}: {
  score: number | null | undefined;
}) {
  const band = scoreBand(score ?? null);
  const styles = {
    none: "bg-[#e3eae3] text-[#3e4a41] border-[#bdcabf]/60 dark:bg-[#1d2b23] dark:text-[#9fb0a3] dark:border-[#2d3d33]",
    low: "bg-[#ffdad6] text-[#93000a] border-[#ba1a1a]/25 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
    medium:
      "bg-[#ffdead]/80 text-[#5d4211] border-[#e8c084]/60 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
    high: "bg-[#c0edcf] text-[#005232] border-[#69dca0]/60 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
  };
  return (
    <span className={cn(PILL_BASE, "tabular-nums", styles[band])}>
      {score != null ? `${score}% Fit` : "Unscored"}
    </span>
  );
}

export function SampleBadge() {
  return (
    <span
      title="Demonstration record. Can be removed from Settings or the top banner."
      className="inline-flex items-center rounded-full border border-[#e8c084] bg-[#ffdead]/80 px-2 py-[2px] text-[10px] leading-[14px] font-semibold uppercase tracking-[0.04em] text-[#5d4211] dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
    >
      Sample
    </span>
  );
}
