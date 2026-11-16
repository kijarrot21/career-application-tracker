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
  // Stage: In Review / Lead (#F59E0B on #FFFBEB with #B45309 text)
  slate: {
    badge:
      "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]/70 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    dot: "bg-[#F59E0B]",
  },
  amber: {
    badge:
      "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]/70 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    dot: "bg-[#F59E0B]",
  },
  orange: {
    badge:
      "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]/70 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    dot: "bg-[#F59E0B]",
  },

  // Stage: Applied / Initial Contact (#204CD3 on #EEF2FF with #1D4ED8 text)
  sky: {
    badge:
      "bg-[#EEF2FF] text-[#1D4ED8] border-[#C7D2FE]/70 dark:bg-[#204CD3]/20 dark:text-[#B7C4FF] dark:border-[#204CD3]/40",
    dot: "bg-[#204CD3]",
  },
  blue: {
    badge:
      "bg-[#EEF2FF] text-[#1D4ED8] border-[#C7D2FE]/70 dark:bg-[#204CD3]/20 dark:text-[#B7C4FF] dark:border-[#204CD3]/40",
    dot: "bg-[#204CD3]",
  },
  indigo: {
    badge:
      "bg-[#EEF2FF] text-[#1D4ED8] border-[#C7D2FE]/70 dark:bg-[#204CD3]/20 dark:text-[#B7C4FF] dark:border-[#204CD3]/40",
    dot: "bg-[#204CD3]",
  },

  // Stage: Active Interview / Offer (#10B981 on #ECFDF5 with #047857 text)
  violet: {
    badge:
      "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]/70 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    dot: "bg-[#10B981]",
  },
  purple: {
    badge:
      "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]/70 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    dot: "bg-[#10B981]",
  },
  fuchsia: {
    badge:
      "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]/70 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    dot: "bg-[#10B981]",
  },
  teal: {
    badge:
      "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]/70 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    dot: "bg-[#10B981]",
  },
  emerald: {
    badge:
      "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]/70 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    dot: "bg-[#10B981]",
  },

  // Stage: Archived / Rejection (#F43F5E on #FFF1F2 with #BE123C text)
  rose: {
    badge:
      "bg-[#FFF1F2] text-[#BE123C] border-[#FECDD3]/70 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
    dot: "bg-[#F43F5E]",
  },
  zinc: {
    badge:
      "bg-[#F1F5F9] text-[#334155] border-[#E2E8F0] dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    dot: "bg-[#64748B]",
  },
  stone: {
    badge:
      "bg-[#FFF1F2] text-[#BE123C] border-[#FECDD3]/70 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
    dot: "bg-[#F43F5E]",
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
  "inline-flex items-center gap-1.5 rounded-full border px-[10px] py-[2px] text-[11px] leading-[14px] font-semibold tracking-[0.04em]";

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
      "bg-[#EEF2FF] text-[#1D4ED8] border-[#C7D2FE]/70 dark:bg-[#204CD3]/20 dark:text-[#B7C4FF] dark:border-[#204CD3]/40",
    successful:
      "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]/70 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
    unsuccessful:
      "bg-[#FFF1F2] text-[#BE123C] border-[#FECDD3]/70 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
    withdrawn:
      "bg-[#F1F5F9] text-[#334155] border-[#E2E8F0] dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    no_response:
      "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]/70 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
  };
  return (
    <span className={cn(PILL_BASE, styles[outcome])}>
      {OUTCOME_LABELS[outcome]}
    </span>
  );
}

export function TriageBadge({ status }: { status: TriageStatus }) {
  const styles: Record<TriageStatus, string> = {
    new: "bg-[#F1F5F9] text-[#334155] border-[#E2E8F0] dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    interested:
      "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]/70 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
    shortlisted:
      "bg-[#EEF2FF] text-[#1D4ED8] border-[#C7D2FE]/70 dark:bg-[#204CD3]/20 dark:text-[#B7C4FF] dark:border-[#204CD3]/40",
    not_interested:
      "bg-[#FFF1F2] text-[#BE123C] border-[#FECDD3]/70 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
    archived:
      "bg-[#FFF1F2] text-[#BE123C] border-[#FECDD3]/70 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
  };
  return (
    <span className={cn(PILL_BASE, styles[status])}>
      {TRIAGE_LABELS[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: JobPriority }) {
  const styles: Record<JobPriority, string> = {
    low: "bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0] dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
    medium:
      "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]/70 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
    high: "bg-[#FFF1F2] text-[#BE123C] border-[#FECDD3]/70 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
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
    none: "bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0] dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
    low: "bg-[#FFF1F2] text-[#BE123C] border-[#FECDD3]/70 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800",
    medium:
      "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]/70 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800",
    high: "bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]/70 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800",
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
      className="inline-flex items-center rounded-full border border-[#F59E0B]/40 bg-[#FFFBEB] px-2 py-[2px] text-[10px] leading-[14px] font-semibold uppercase tracking-[0.04em] text-[#B45309] dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
    >
      Sample
    </span>
  );
}
