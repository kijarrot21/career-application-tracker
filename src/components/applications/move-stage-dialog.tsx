"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
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

  if (!open) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171d19]/35 p-4 backdrop-blur-[3px]">
      <div className="elevation-4 w-full max-w-md rounded-2xl border border-[#bdcabf]/60 bg-[#ffffff] p-6 dark:border-[#24332a] dark:bg-[#111a15]">
        <div className="mb-4 flex items-center justify-between border-b border-[#e3eae3] pb-3 dark:border-[#24332a]">
          <div>
            <h2 className="text-headline-sm text-[#171d19] dark:text-[#ecf3eb]">
              Update Recruitment Stage
            </h2>
            <p className="text-xs text-[#3f674f] dark:text-[#a5d1b4]">
              {applicationLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#3e4a41] hover:bg-[#eff5ee] hover:text-[#006a42] dark:text-[#b7c6ba] dark:hover:bg-[#17231c]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {error && (
            <div className="rounded-xl border border-[#ba1a1a]/30 bg-[#ffdad6] px-3 py-2 text-[#93000a] dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
              Target Stage
            </label>
            <select
              value={toStageId}
              onChange={(e) => setToStageId(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#eff5ee] px-3 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
            >
              {selectableStages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.id === fromStage.id ? "(Current)" : ""}
                </option>
              ))}
            </select>
          </div>

          {transition.kind === "skip" && transition.skipped.length > 0 && (
            <div className="rounded-xl border border-[#a5d1b4] bg-[#c0edcf]/60 px-3 py-2 text-[#005232] dark:border-[#006a42]/40 dark:bg-[#006a42]/20 dark:text-[#86f9ba]">
              Skipping intermediate stage(s):{" "}
              <strong>{transition.skipped.map((s) => s.name).join(", ")}</strong>.
              This will be preserved in the timeline.
            </div>
          )}

          {transition.kind === "backward" && (
            <div className="rounded-xl border border-[#e8c084] bg-[#ffdead]/60 px-3 py-2 text-[#5d4211] dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Moving backward from {fromStage.name} to {toStage.name}. This will
              be recorded as a stage correction.
            </div>
          )}

          {transition.kind === "terminal" && (
            <div className="rounded-xl border border-[#bdcabf]/60 bg-[#eff5ee] px-3 py-2 text-[#3e4a41] dark:border-[#24332a] dark:bg-[#17231c] dark:text-[#b7c6ba]">
              Moving to <strong>{toStage.name}</strong> closes this application
              and cancels open follow-up reminders.
            </div>
          )}

          <div>
            <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
              Effective Date
            </label>
            <input
              type="date"
              required
              value={effectiveOn}
              onChange={(e) => setEffectiveOn(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#eff5ee] px-3 text-xs text-[#171d19] tabular-nums dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
              Reason {transition.kind === "reopen" ? "*" : "(optional)"}
            </label>
            <input
              type="text"
              required={transition.kind === "reopen"}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                transition.kind === "terminal"
                  ? "e.g., Accepted offer / Employer filled role internally"
                  : "Reason for stage transition"
              }
              className="mt-1 h-10 w-full rounded-xl border border-[#bdcabf]/70 bg-[#eff5ee] px-3 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#3e4a41] dark:text-[#b7c6ba]">
              Timeline Note (optional)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Recruiter feedback, assessment details, or next steps..."
              className="mt-1 w-full rounded-xl border border-[#bdcabf]/70 bg-[#eff5ee] px-3 py-2 text-xs text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-[#e3eae3] pt-3 dark:border-[#24332a]">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary h-10 px-4 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || transition.kind === "same"}
              className="btn-primary h-10 px-4 text-xs disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Confirm Stage Move"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
