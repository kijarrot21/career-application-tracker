"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SuitabilityBadge } from "@/components/ui/badges";
import {
  CRITERIA,
  CRITERION_LABELS,
  overallScore,
  type Criterion,
  type Suggestion,
  type Weights,
} from "@/lib/domain/suitability";
import { saveSuitabilityAction } from "@/server/actions/vacancies";

export function SuitabilityPanel({
  vacancyId,
  initialScores,
  suggestions,
  weights,
}: {
  vacancyId: string;
  initialScores: Record<Criterion, number | null>;
  suggestions: Record<Criterion, Suggestion>;
  weights: Weights;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [scores, setScores] = useState<Record<Criterion, number | null>>(
    initialScores,
  );

  const liveOverall = overallScore(scores, weights);

  function handleApplySuggestions() {
    setScores((prev) => ({
      skills: suggestions.skills.score ?? prev.skills,
      experience: suggestions.experience.score ?? prev.experience,
      education: suggestions.education.score ?? prev.education,
      salary: suggestions.salary.score ?? prev.salary,
      location: suggestions.location.score ?? prev.location,
      growth: prev.growth ?? 80,
    }));
  }

  function handleSave() {
    startTransition(async () => {
      try {
        const res = await saveSuitabilityAction(vacancyId, {
          ...scores,
          notes: null,
        });
        toast.success(
          `Suitability score saved (${res.overallScore ?? 0}% overall fit).`,
        );
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to save suitability evaluation",
        );
      }
    });
  }

  return (
    <div className="elevation-1 space-y-4 rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-6 dark:border-[#24332a] dark:bg-[#111a15]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e3eae3] pb-3.5 dark:border-[#24332a]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
              Job Suitability Evaluation (0 to 100%)
            </h3>
            <SuitabilityBadge score={liveOverall} />
          </div>
          <p className="text-xs text-[#3f674f] dark:text-[#a5d1b4]">
            Weighted evaluation across 6 HR suitability criteria
          </p>
        </div>

        <button
          type="button"
          onClick={handleApplySuggestions}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#c0edcf] px-3 py-1.5 text-xs font-semibold text-[#005232] transition-colors hover:bg-[#006a42] hover:text-white dark:bg-[#005232] dark:text-[#86f9ba]"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Apply Profile Suggestions
        </button>
      </div>

      <div className="space-y-3">
        {CRITERIA.map((criterion) => {
          const val = scores[criterion];
          const sug = suggestions[criterion];
          const weight = weights[criterion];

          return (
            <div
              key={criterion}
              className="rounded-xl bg-[#eff5ee] p-3.5 text-xs dark:bg-[#17231c]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-[#171d19] dark:text-[#ecf3eb]">
                    {CRITERION_LABELS[criterion]}
                  </span>{" "}
                  <span className="font-mono text-[11px] text-[#3f674f] tabular-nums dark:text-[#a5d1b4]">
                    (weight {weight}%)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[#006a42] tabular-nums dark:text-[#69dca0]">
                    {val != null ? `${val}%` : "Not rated"}
                  </span>
                  {val != null && (
                    <button
                      type="button"
                      onClick={() =>
                        setScores((p) => ({ ...p, [criterion]: null }))
                      }
                      className="text-[11px] font-semibold text-[#3f674f] hover:text-[#171d19]"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  aria-label={CRITERION_LABELS[criterion]}
                  value={val ?? 0}
                  onChange={(e) =>
                    setScores((p) => ({
                      ...p,
                      [criterion]: Number(e.target.value),
                    }))
                  }
                  className="h-1.5 flex-1 cursor-pointer accent-[#006a42]"
                />
              </div>

              {sug && (
                <p className="mt-1.5 text-[11px] text-[#3f674f] tabular-nums dark:text-[#a5d1b4]">
                  {sug.score != null ? `Suggested ${sug.score}%: ` : ""}
                  {sug.reason}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          disabled={isPending}
          onClick={handleSave}
          className="btn-primary h-10 px-4 text-xs disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Suitability Score"}
        </button>
      </div>
    </div>
  );
}
