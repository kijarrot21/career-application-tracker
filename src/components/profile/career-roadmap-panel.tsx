"use client";

import { Compass, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AiConsentDialog,
  type PendingConsentPrompt,
} from "@/components/ai/ai-consent-dialog";
import { Badge, Button, Card, FormField, Input } from "@/components/ui";
import {
  approveAndRunAiJobAction,
  cancelAiJobAction,
  generateCareerRoadmapWithAiAction,
} from "@/server/actions/ai-career";
import type { AiCareerRoadmap } from "@/server/ai/schemas";

export function CareerRoadmapPanel({
  defaultTargetRole,
  initialRoadmap,
}: {
  defaultTargetRole: string;
  initialRoadmap?: AiCareerRoadmap | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [targetRole, setTargetRole] = useState(defaultTargetRole);
  const [roadmap, setRoadmap] = useState<AiCareerRoadmap | null>(
    initialRoadmap ?? null,
  );
  const [pendingConsent, setPendingConsent] =
    useState<PendingConsentPrompt | null>(null);

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!targetRole.trim()) return;
    startTransition(async () => {
      try {
        const res = await generateCareerRoadmapWithAiAction({
          targetRole: targetRole.trim(),
          horizonMonths: 12,
        });
        if (res.status === "awaiting_consent") {
          setPendingConsent(res);
          return;
        }
        setRoadmap(res.data);
        toast.success("6-month & 12-month career roadmap generated.");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Roadmap generation failed",
        );
      }
    });
  }

  function handleApproveConsent(jobId: string) {
    startTransition(async () => {
      try {
        const res = await approveAndRunAiJobAction(jobId);
        setPendingConsent(null);
        if (res.status === "completed") {
          setRoadmap(res.data as AiCareerRoadmap);
          toast.success("Career roadmap generated.");
          router.refresh();
        }
      } catch (err) {
        setPendingConsent(null);
        toast.error(
          err instanceof Error ? err.message : "Roadmap generation failed",
        );
      }
    });
  }

  function handleCancelConsent(jobId: string) {
    startTransition(async () => {
      await cancelAiJobAction(jobId).catch(() => {});
      setPendingConsent(null);
    });
  }

  return (
    <div className="space-y-4 text-xs">
      <Card padding="md">
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-primary-text" />
            <h3 className="text-section-title text-foreground">
              AI Career Roadmap (6-Month &amp; 12-Month Plan)
            </h3>
          </div>
          <p className="text-muted-foreground">
            Analyzes your Master Career Profile, verified skills, career
            targets, and recorded application history while keeping verified
            facts separate from AI inferences.
          </p>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[260px] flex-1">
              <FormField label="Target Career Role">
                <Input
                  inputSize="lg"
                  required
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g. Principal Backend Engineer"
                />
              </FormField>
            </div>
            <Button type="submit" variant="primary" size="lg" disabled={isPending}>
              <Sparkles className="h-3.5 w-3.5" />
              Generate Career Roadmap
            </Button>
          </div>
        </form>
      </Card>

      {roadmap && (
        <div className="space-y-4">
          <Card padding="md" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-section-title text-foreground">
                Roadmap for {roadmap.targetRole}
              </h4>
              <Badge variant="primary">
                Readiness Index: {roadmap.readinessScore}/100
              </Badge>
            </div>
            <p className="text-foreground">{roadmap.summary}</p>
            {roadmap.applicationHistoryInsights && (
              <p className="text-muted-foreground">
                History analyzed:{" "}
                {roadmap.applicationHistoryInsights.applicationsAnalyzed}{" "}
                application(s).{" "}
                {roadmap.applicationHistoryInsights.unknownRejectionReasonsNote}
              </p>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card padding="md" className="space-y-2">
              <h4 className="font-semibold text-foreground">
                Verified Facts Used
              </h4>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                {roadmap.verifiedFacts.map((fact, idx) => (
                  <li key={idx}>{fact}</li>
                ))}
              </ul>
            </Card>

            <Card padding="md" className="space-y-2">
              <h4 className="font-semibold text-foreground">
                AI Inferences (Advisory)
              </h4>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                {roadmap.aiInferences.map((inf, idx) => (
                  <li key={idx}>
                    <span className="text-foreground">{inf.inference}</span>{" "}
                    <span>(Basis: {inf.basis})</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card padding="md" className="space-y-2">
              <h4 className="font-semibold text-foreground">6-Month Plan</h4>
              {(roadmap.sixMonthPlan.length > 0
                ? roadmap.sixMonthPlan
                : roadmap.milestones
              ).map((m, idx) => (
                <div
                  key={idx}
                  className="rounded border border-border-subtle p-2.5 space-y-1"
                >
                  <p className="font-semibold text-foreground">
                    {m.phase} ({m.timeframe}) — {m.focusArea}
                  </p>
                  <ul className="list-disc pl-4 text-muted-foreground">
                    {m.actions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </Card>

            <Card padding="md" className="space-y-2">
              <h4 className="font-semibold text-foreground">12-Month Plan</h4>
              {roadmap.twelveMonthPlan.map((m, idx) => (
                <div
                  key={idx}
                  className="rounded border border-border-subtle p-2.5 space-y-1"
                >
                  <p className="font-semibold text-foreground">
                    {m.phase} ({m.timeframe}) — {m.focusArea}
                  </p>
                  <ul className="list-disc pl-4 text-muted-foreground">
                    {m.actions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </Card>
          </div>
        </div>
      )}

      <AiConsentDialog
        pending={pendingConsent}
        pendingAction={isPending}
        onApprove={handleApproveConsent}
        onCancel={handleCancelConsent}
      />
    </div>
  );
}
