"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import type { HistorySource } from "@/lib/constants";
import { classifyTransition, type StageLike } from "@/lib/domain/stages";
import { moveApplicationStageAction } from "@/server/actions/applications";

export function MoveStageDialog({
  open,
  onClose,
  applicationId,
  applicationLabel,
  fromStage,
  initialToStage,
  stages,
  source = "manual",
  onMoved,
}: {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  applicationLabel: string;
  fromStage: StageLike;
  initialToStage?: StageLike;
  stages: StageLike[];
  source?: HistorySource;
  onMoved?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const selectableStages = stages.filter(
    (s) => s.stageType !== "sourced" && s.stageType !== "interested",
  );
  const [toStageId, setToStageId] = useState(
    initialToStage?.id ??
      selectableStages.find((s) => s.id !== fromStage.id)?.id ??
      fromStage.id,
  );
  const [effectiveOn, setEffectiveOn] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const toStage = selectableStages.find((s) => s.id === toStageId) ?? fromStage;
  const transition = classifyTransition(fromStage, toStage, stages);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await moveApplicationStageAction({
          applicationId,
          toStageId: toStage.id,
          effectiveOn,
          source,
          reason: reason || null,
          note: note || null,
        });
        toast.success(`Moved to ${toStage.name}.`);
        onClose();
        if (onMoved) onMoved();
        else router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not move stage.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update Recruitment Stage</DialogTitle>
          <DialogDescription>{applicationLabel}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive-border bg-destructive-soft px-3 py-2 text-destructive-on-soft"
            >
              {error}
            </div>
          )}

          <FormField label="Target Stage" required>
            <Select
              selectSize="lg"
              inputMode="text"
              value={toStageId}
              onChange={(e) => setToStageId(e.target.value)}
            >
              {selectableStages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.id === fromStage.id ? "(Current)" : ""}
                </option>
              ))}
            </Select>
          </FormField>

          {transition.kind === "skip" && transition.skipped.length > 0 && (
            <div className="rounded-xl border border-success-border bg-success-soft px-3 py-2 text-success-on-soft">
              Skipping intermediate stage(s):{" "}
              <strong>{transition.skipped.map((s) => s.name).join(", ")}</strong>.
              This will be preserved in the timeline.
            </div>
          )}

          {transition.kind === "backward" && (
            <div className="rounded-xl border border-warning-border bg-warning-soft px-3 py-2 text-warning-on-soft">
              Moving backward from {fromStage.name} to {toStage.name}. This will
              be recorded as a stage correction.
            </div>
          )}

          {transition.kind === "terminal" && (
            <div className="rounded-xl border border-border bg-surface-subtle px-3 py-2 text-muted-foreground">
              Moving to <strong className="text-foreground">{toStage.name}</strong>{" "}
              closes this application and cancels open follow-up reminders.
            </div>
          )}

          <FormField label="Effective Date" required>
            <Input
              type="date"
              inputSize="lg"
              required
              value={effectiveOn}
              onChange={(e) => setEffectiveOn(e.target.value)}
              className="tabular-nums"
            />
          </FormField>

          <FormField
            label={transition.kind === "reopen" ? "Reason" : "Reason (optional)"}
            required={transition.kind === "reopen"}
          >
            <Input
              type="text"
              inputSize="lg"
              required={transition.kind === "reopen"}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                transition.kind === "terminal"
                  ? "e.g., Accepted offer / Employer filled role internally"
                  : "Reason for stage transition"
              }
            />
          </FormField>

          <FormField label="Timeline Note (optional)">
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Recruiter feedback, assessment details, or next steps..."
            />
          </FormField>

          <DialogFooter>
            <Button variant="secondary" size="lg" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isPending || transition.kind === "same"}
            >
              {isPending ? "Saving..." : "Confirm Stage Move"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
