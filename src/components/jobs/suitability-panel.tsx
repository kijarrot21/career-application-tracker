"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, Card, SuitabilityBadge } from "@/components/ui";
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
    <Card padding="lg" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-section-title text-foreground">
              Job Suitability Evaluation (0 to 100%)
            </h3>
            <SuitabilityBadge score={liveOverall} />
          </div>
          <p className="text-caption text-muted-foreground">
            Weighted evaluation across 6 HR suitability criteria
          </p>
        </div>

        <Button
          variant="soft"
          size="sm"
          onClick={handleApplySuggestions}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Apply Profile Suggestions
        </Button>
      </div>

      <div className="space-y-3">
        {CRITERIA.map((criterion) => {
          const val = scores[criterion];
          const sug = suggestions[criterion];
          const weight = weights[criterion];

          return (
            <div
              key={criterion}
              className="rounded-xl bg-surface-subtle p-3.5 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-foreground">
                    {CRITERION_LABELS[criterion]}
                  </span>{" "}
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    (weight {weight}%)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-primary-text tabular-nums">
                    {val != null ? `${val}%` : "Not rated"}
                  </span>
                  {val != null && (
                    <Button
                      type="button"
                      variant="link"
                      size="xs"
                      onClick={() =>
                        setScores((p) => ({ ...p, [criterion]: null }))
                      }
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </Button>
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
                  className="h-1.5 flex-1 cursor-pointer accent-primary"
                />
              </div>

              {sug && (
                <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
                  {sug.score != null ? `Suggested ${sug.score}%: ` : ""}
                  {sug.reason}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-1">
        <Button
          variant="primary"
          size="lg"
          disabled={isPending}
          onClick={handleSave}
        >
          {isPending ? "Saving..." : "Save Suitability Score"}
        </Button>
      </div>
    </Card>
  );
}
