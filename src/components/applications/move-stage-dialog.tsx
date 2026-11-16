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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1C30]/20 p-4 backdrop-blur-[1px]">
      <div className="elevation-4 w-full max-w-md rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between border-b border-[#E2E8F0] pb-2.5 dark:border-slate-800">
          <div>
            <h2 className="text-headline-sm text-[#0F172A] dark:text-slate-100">
              Update Recruitment Stage
            </h2>
            <p className="text-xs text-[#64748B]">{applicationLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[4px] p-1 text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#204CD3] dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {error && (
            <div className="rounded-[4px] border border-[#F43F5E]/40 bg-[#FFF1F2] px-3 py-2 text-[#BE123C] dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-[#334155] dark:text-slate-300">
              Target Stage
            </label>
            <select
              value={toStageId}
              onChange={(e) => setToStageId(e.target.value)}
              className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              {selectableStages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.id === fromStage.id ? "(Current)" : ""}
                </option>
              ))}
            </select>
          </div>

          {transition.kind === "skip" && transition.skipped.length > 0 && (
            <div className="rounded-[4px] border border-[#204CD3]/30 bg-[#EEF2FF] px-3 py-2 text-[#1D4ED8] dark:border-[#204CD3]/40 dark:bg-[#204CD3]/20 dark:text-[#B7C4FF]">
              Skipping intermediate stage(s):{" "}
              <strong>{transition.skipped.map((s) => s.name).join(", ")}</strong>.
              This will be preserved in the timeline.
            </div>
          )}

          {transition.kind === "backward" && (
            <div className="rounded-[4px] border border-[#F59E0B]/40 bg-[#FFFBEB] px-3 py-2 text-[#B45309] dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Moving backward from {fromStage.name} to {toStage.name}. This will
              be recorded as a stage correction.
            </div>
          )}

          {transition.kind === "terminal" && (
            <div className="rounded-[4px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[#334155] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              Moving to <strong>{toStage.name}</strong> closes this application
              and cancels open follow-up reminders.
            </div>
          )}

          <div>
            <label className="block font-semibold text-[#334155] dark:text-slate-300">
              Effective Date
            </label>
            <input
              type="date"
              required
              value={effectiveOn}
              onChange={(e) => setEffectiveOn(e.target.value)}
              className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#334155] dark:text-slate-300">
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
              className="mt-1 h-10 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#334155] dark:text-slate-300">
              Timeline Note (optional)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Recruiter feedback, assessment details, or next steps..."
              className="mt-1 w-full rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 py-2 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-[#E2E8F0] pt-3 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:border-[#94A3B8] hover:bg-[#F8FAFC] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || transition.kind === "same"}
              className="rounded-[4px] bg-[#204CD3] px-4 py-1.5 text-xs font-semibold text-white transition-all hover:bg-[#1D4ED8] active:scale-[0.98] disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Confirm Stage Move"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
