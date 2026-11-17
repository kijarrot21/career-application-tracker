"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AiConsentDialog,
  type PendingConsentPrompt,
} from "@/components/ai/ai-consent-dialog";
import { Badge, Button, Card, FormField, Select } from "@/components/ui";
import {
  approveAndRunAiJobAction,
  cancelAiJobAction,
  matchJobWithAiAction,
} from "@/server/actions/ai-career";
import type { AiJobMatchResult } from "@/server/ai/schemas";
import type { listCvVersionsForProfileImport } from "@/server/services/career-profile";

type CvVersionOption = Awaited<
  ReturnType<typeof listCvVersionsForProfileImport>
>[number];

export function JobMatchAiPanel({
  vacancyId,
  cvVersions,
}: {
  vacancyId: string;
  cvVersions: CvVersionOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedCvVersionId, setSelectedCvVersionId] = useState("");
  const [result, setResult] = useState<AiJobMatchResult | null>(null);
  const [pendingConsent, setPendingConsent] =
    useState<PendingConsentPrompt | null>(null);

  function handleRunMatch() {
    startTransition(async () => {
      try {
        const res = await matchJobWithAiAction({
          vacancyId,
          documentVersionId: selectedCvVersionId || undefined,
        });
        if (res.status === "awaiting_consent") {
          setPendingConsent(res);
          return;
        }
        setResult(res.data);
        toast.success("AI Job Match analysis completed.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Job match failed");
      }
    });
  }

  function handleApproveConsent(jobId: string) {
    startTransition(async () => {
      try {
        const res = await approveAndRunAiJobAction(jobId);
        setPendingConsent(null);
        if (res.status === "completed") {
          setResult(res.data as AiJobMatchResult);
          toast.success("AI Job Match completed.");
          router.refresh();
        }
      } catch (err) {
        setPendingConsent(null);
        toast.error(err instanceof Error ? err.message : "Job match failed");
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
    <Card padding="md" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-section-title text-foreground">
            AI Profile &amp; CV Job Match
          </h2>
          <p className="text-xs text-muted-foreground">
            Compares your verified Master Career Profile and optional selected
            CV against this vacancy.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={isPending}
          onClick={handleRunMatch}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Analyze Job Match
        </Button>
      </div>

      <FormField label="Optional CV Version for Comparison">
        <Select
          value={selectedCvVersionId}
          onChange={(e) => setSelectedCvVersionId(e.target.value)}
        >
          <option value="">Master Career Profile Only</option>
          {cvVersions.map((v) => (
            <option key={v.versionId} value={v.versionId}>
              {v.title} · v{v.versionNo} ({v.label})
            </option>
          ))}
        </Select>
      </FormField>

      {result && (
        <div className="space-y-3 border-t border-border-subtle pt-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary">
              Match Score: {result.overallMatchScore}/100
            </Badge>
            <Badge variant="secondary">
              Confidence: {result.confidenceScore}/100
            </Badge>
          </div>
          <p className="text-foreground">{result.summary}</p>

          {result.matchingSkills.length > 0 && (
            <div>
              <p className="font-semibold text-foreground">Matching Skills</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {result.matchingSkills.map((sk) => (
                  <Badge key={sk} variant="success">
                    {sk}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {result.missingSkills.length > 0 && (
            <div>
              <p className="font-semibold text-foreground">Missing Skills</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {result.missingSkills.map((sk) => (
                  <Badge key={sk} variant="warning">
                    {sk}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {result.transferableSkills.length > 0 && (
            <div>
              <p className="font-semibold text-foreground">
                Transferable Skills
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {result.transferableSkills.map((sk) => (
                  <Badge key={sk} variant="secondary">
                    {sk}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {result.qualificationGaps.length > 0 && (
            <div>
              <p className="font-semibold text-foreground">
                Qualification Gaps
              </p>
              <ul className="mt-1 list-disc pl-4 space-y-1 text-muted-foreground">
                {result.qualificationGaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
          )}

          {result.recommendations.length > 0 && (
            <div>
              <p className="font-semibold text-foreground">Recommendations</p>
              <ul className="mt-1 list-disc pl-4 space-y-1 text-muted-foreground">
                {result.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <AiConsentDialog
        pending={pendingConsent}
        pendingAction={isPending}
        onApprove={handleApproveConsent}
        onCancel={handleCancelConsent}
      />
    </Card>
  );
}
