"use client";

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, Clock, GripVertical, Plus, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MoveStageDialog } from "@/components/applications/move-stage-dialog";
import {
  RecordSubmissionDialog,
  type VacancyOptionForSubmission,
} from "@/components/applications/record-submission-dialog";
import {
  getStageColorStyle,
  OutcomeBadge,
  SampleBadge,
  StageBadge,
  SuitabilityBadge,
} from "@/components/ui/badges";
import {
  classifyTransition,
  isVacancyLevel,
  requiresDialog,
  type StageLike,
} from "@/lib/domain/stages";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { moveApplicationStageAction } from "@/server/actions/applications";
import { setVacancyTriageAction } from "@/server/actions/vacancies";
import type { getKanbanBoardData } from "@/server/queries/applications";

type BoardData = Awaited<ReturnType<typeof getKanbanBoardData>>;
type AppItem = BoardData["applications"][number];
type VacancyItem = BoardData["unappliedVacancies"][number];

function getCompanyInitials(name: string) {
  return name
    .replace(/^PT\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function KanbanBoard({
  stages,
  applications,
  unappliedVacancies,
  sources,
  defaultCurrency,
  onQuickAdd,
}: {
  stages: BoardData["stages"];
  applications: AppItem[];
  unappliedVacancies: VacancyItem[];
  sources: { id: string; key: string; name: string }[];
  defaultCurrency: string;
  onQuickAdd?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mobileLaneId, setMobileLaneId] = useState<string>("all");

  const [applyVacancy, setApplyVacancy] =
    useState<VacancyOptionForSubmission | null>(null);
  const [dialogMove, setDialogMove] = useState<{
    app: AppItem;
    toStage: StageLike;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const appStages = stages.filter((s) => !isVacancyLevel(s.stageType));
  const noResponseStage = stages.find((s) => s.stageType === "no_response");

  function handleMoveApplication(app: AppItem, toStageId: string) {
    const toStage = stages.find((s) => s.id === toStageId);
    if (!toStage || toStage.id === app.currentStageId) return;

    const transition = classifyTransition(app.stage, toStage, stages);
    if (transition.kind === "invalid") {
      toast.error(transition.error ?? "Invalid stage transition.");
      return;
    }

    if (requiresDialog(transition.kind)) {
      setDialogMove({ app, toStage });
      return;
    }

    startTransition(async () => {
      try {
        const res = await moveApplicationStageAction({
          applicationId: app.id,
          toStageId: toStage.id,
          source: "kanban",
        });
        if (res.transition.skipped.length > 0) {
          toast.success(
            `Moved ${app.code} to ${toStage.name} (skipped: ${res.transition.skipped
              .map((s) => s.name)
              .join(", ")}).`,
          );
        } else {
          toast.success(`Moved ${app.code} to ${toStage.name}.`);
        }
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not move stage");
      }
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const targetStageId = String(over.id);
    const targetStage = stages.find((s) => s.id === targetStageId);
    if (!targetStage) return;

    const activeData = active.data.current as
      | { kind: "application"; app: AppItem }
      | { kind: "vacancy"; vacancy: VacancyItem }
      | undefined;

    if (!activeData) return;

    if (activeData.kind === "vacancy") {
      const vac = activeData.vacancy;
      if (targetStage.stageType === "sourced") {
        startTransition(async () => {
          await setVacancyTriageAction(vac.id, "new");
          router.refresh();
        });
      } else if (targetStage.stageType === "interested") {
        startTransition(async () => {
          await setVacancyTriageAction(vac.id, "interested");
          toast.success(`Marked ${vac.code} as Interested.`);
          router.refresh();
        });
      } else {
        setApplyVacancy({
          id: vac.id,
          code: vac.code,
          title: vac.title,
          companyName: vac.company.name,
          url: vac.url,
          sourceId: vac.sourceId,
          department: vac.department,
        });
      }
      return;
    }

    if (activeData.kind === "application") {
      handleMoveApplication(activeData.app, targetStage.id);
    }
  }

  return (
    <>
      {/* Mobile (<768px) Segmented-Control Lane Selector */}
      <div className="flex gap-1.5 overflow-x-auto rounded-[8px] border border-[#E2E8F0] bg-[#F1F5F9] p-1 md:hidden dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setMobileLaneId("all")}
          className={cn(
            "shrink-0 rounded-[4px] px-2.5 py-1 text-[11px] font-semibold transition-colors",
            mobileLaneId === "all"
              ? "bg-[#204CD3] text-white"
              : "text-[#64748B] hover:text-[#0F172A]",
          )}
        >
          All Lanes
        </button>
        {stages.map((st) => (
          <button
            key={st.id}
            type="button"
            onClick={() => setMobileLaneId(st.id)}
            className={cn(
              "shrink-0 rounded-[4px] px-2.5 py-1 text-[11px] font-semibold transition-colors",
              mobileLaneId === st.id
                ? "bg-[#204CD3] text-white"
                : "text-[#64748B] hover:text-[#0F172A]",
            )}
          >
            {st.name}
          </button>
        ))}
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4"
          aria-label="Recruitment pipeline Kanban board"
        >
          {stages.map((stage) => {
            const style = getStageColorStyle(stage.color, stage.name);
            const isVacStage = isVacancyLevel(stage.stageType);

            const columnVacancies = isVacStage
              ? unappliedVacancies.filter((v) =>
                  stage.stageType === "sourced"
                    ? v.triageStatus === "new"
                    : v.triageStatus === "interested" ||
                      v.triageStatus === "shortlisted",
                )
              : [];

            const columnApps = !isVacStage
              ? applications.filter((a) => a.currentStageId === stage.id)
              : [];

            const count = isVacStage
              ? columnVacancies.length
              : columnApps.length;

            const hiddenOnMobile =
              mobileLaneId !== "all" && mobileLaneId !== stage.id;

            return (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                dotClass={style.dot}
                count={count}
                subtitle={isVacStage ? "Pre-application vacancies" : undefined}
                hiddenOnMobile={hiddenOnMobile}
                onQuickAdd={
                  isVacStage
                    ? () => router.push("/jobs/new")
                    : onQuickAdd ?? (() => router.push("/applications?new=1"))
                }
              >
                {isVacStage
                  ? columnVacancies.map((vac) => (
                      <DraggableVacancyCard
                        key={vac.id}
                        vacancy={vac}
                        onRecordApply={() =>
                          setApplyVacancy({
                            id: vac.id,
                            code: vac.code,
                            title: vac.title,
                            companyName: vac.company.name,
                            url: vac.url,
                            sourceId: vac.sourceId,
                            department: vac.department,
                          })
                        }
                      />
                    ))
                  : columnApps.map((app) => (
                      <DraggableApplicationCard
                        key={app.id}
                        app={app}
                        appStages={appStages}
                        noResponseStage={noResponseStage}
                        disabled={isPending}
                        onMoveTo={(toId) => handleMoveApplication(app, toId)}
                        onConfirmNoResponse={() => {
                          if (noResponseStage) {
                            setDialogMove({ app, toStage: noResponseStage });
                          }
                        }}
                      />
                    ))}
              </KanbanColumn>
            );
          })}
        </div>
      </DndContext>

      {applyVacancy && (
        <RecordSubmissionDialog
          open={true}
          onClose={() => setApplyVacancy(null)}
          preselectedVacancy={applyVacancy}
          sources={sources}
          defaultCurrency={defaultCurrency}
          onCreated={() => router.refresh()}
        />
      )}

      {dialogMove && (
        <MoveStageDialog
          open={true}
          onClose={() => setDialogMove(null)}
          applicationId={dialogMove.app.id}
          applicationLabel={`${dialogMove.app.code}: ${dialogMove.app.vacancy.title} at ${dialogMove.app.company.name}`}
          fromStage={dialogMove.app.stage}
          initialToStage={dialogMove.toStage}
          stages={stages}
          source="kanban"
          onMoved={() => router.refresh()}
        />
      )}
    </>
  );
}

function KanbanColumn({
  stage,
  dotClass,
  count,
  subtitle,
  hiddenOnMobile,
  onQuickAdd,
  children,
}: {
  stage: StageLike;
  dotClass: string;
  count: number;
  subtitle?: string;
  hiddenOnMobile?: boolean;
  onQuickAdd?: () => void;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: stage.id,
  });

  return (
    <div
      ref={setNodeRef}
      data-testid={`kanban-col-${stage.stageType}-${stage.name}`}
      className={cn(
        "elevation-1 flex min-w-[280px] max-w-[340px] w-[300px] shrink-0 snap-start flex-col rounded-[8px] border p-3 transition-colors",
        hiddenOnMobile && "hidden md:flex",
        isOver
          ? "border-[#204CD3] bg-[#EEF2FF]/60 dark:border-[#204CD3] dark:bg-[#204CD3]/15"
          : "border-[#E2E8F0] bg-[#F1F5F9] dark:border-slate-800 dark:bg-slate-900/60",
      )}
    >
      <div className="mb-3 flex items-center justify-between px-0.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
            <h3 className="truncate font-display text-[13px] font-semibold tracking-[-0.01em] text-[#0F172A] dark:text-slate-100">
              {stage.name}
            </h3>
            <span className="rounded-full bg-[#E2E8F0] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#334155] tabular-nums dark:bg-slate-800 dark:text-slate-300">
              {count}
            </span>
          </div>
          {subtitle && (
            <p className="mt-0.5 text-[10px] text-[#64748B]">{subtitle}</p>
          )}
        </div>

        {onQuickAdd && (
          <button
            type="button"
            onClick={onQuickAdd}
            title={`Quick add to ${stage.name}`}
            aria-label={`Quick add to ${stage.name}`}
            className="rounded-[4px] p-1 text-[#64748B] transition-colors hover:bg-[#EEF2FF] hover:text-[#204CD3]"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex min-h-[180px] flex-1 flex-col gap-2.5">
        {children}
      </div>
    </div>
  );
}

function DraggableVacancyCard({
  vacancy,
  onRecordApply,
}: {
  vacancy: VacancyItem;
  onRecordApply: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `vac-${vacancy.id}`,
      data: { kind: "vacancy", vacancy },
    });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-[14px] text-[13px] leading-[18px] dark:border-slate-800 dark:bg-slate-900",
        isDragging ? "elevation-3 z-20" : "elevation-2",
      )}
    >
      {/* Top row: Company avatar (24x24px rounded-sm) + Company Name (body-sm, bold) + Date Added */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-[#EEF2FF] font-display text-[10px] font-bold text-[#1D4ED8] dark:bg-[#204CD3]/20 dark:text-[#B7C4FF]">
            {getCompanyInitials(vacancy.company.name)}
          </span>
          <span className="truncate text-[13px] font-semibold text-[#0F172A] dark:text-slate-100">
            {vacancy.company.name}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="font-mono text-[11px] text-[#64748B] tabular-nums">
            {formatDate(vacancy.discoveredOn)}
          </span>
          <button
            type="button"
            {...listeners}
            {...attributes}
            aria-label={`Drag ${vacancy.title}`}
            className="cursor-grab rounded-[4px] p-0.5 text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#204CD3]"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Middle row: Target Role (headline-sm, 1-line truncation) + Code / Fit */}
      <div className="mt-2">
        <Link
          href={`/jobs/${vacancy.id}`}
          className="text-headline-sm block truncate text-[#0F172A] hover:text-[#204CD3] dark:text-slate-100"
        >
          {vacancy.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[11px] text-[#64748B] tabular-nums">
            {vacancy.code}
          </span>
          {vacancy.isSample && <SampleBadge />}
        </div>
      </div>

      {/* Bottom row: Suitability Pill Badge + Apply action */}
      <div className="mt-3 flex items-center justify-between border-t border-[#E2E8F0] pt-2.5 dark:border-slate-800">
        <SuitabilityBadge score={vacancy.suitabilityScore} />
        <button
          type="button"
          onClick={onRecordApply}
          className="inline-flex items-center gap-1 rounded-[4px] bg-[#EEF2FF] px-2.5 py-1 text-[11px] font-semibold text-[#1D4ED8] transition-colors hover:bg-[#204CD3] hover:text-white dark:bg-[#204CD3]/20 dark:text-[#B7C4FF]"
        >
          <Send className="h-3 w-3" />
          Apply
        </button>
      </div>
    </div>
  );
}

function DraggableApplicationCard({
  app,
  appStages,
  noResponseStage,
  disabled,
  onMoveTo,
  onConfirmNoResponse,
}: {
  app: AppItem;
  appStages: StageLike[];
  noResponseStage?: StageLike;
  disabled?: boolean;
  onMoveTo: (toStageId: string) => void;
  onConfirmNoResponse: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `app-${app.id}`,
      data: { kind: "application", app },
    });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`app-card-${app.code}`}
      className={cn(
        "rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-[14px] text-[13px] leading-[18px] dark:border-slate-800 dark:bg-slate-900",
        isDragging ? "elevation-3 z-20" : "elevation-2",
      )}
    >
      {/* Top row: Company avatar (24x24px rounded-sm) + Company Name (body-sm, bold) + Date Added */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-[#EEF2FF] font-display text-[10px] font-bold text-[#1D4ED8] dark:bg-[#204CD3]/20 dark:text-[#B7C4FF]">
            {getCompanyInitials(app.company.name)}
          </span>
          <span className="truncate text-[13px] font-semibold text-[#0F172A] dark:text-slate-100">
            {app.company.name}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="font-mono text-[11px] text-[#64748B] tabular-nums">
            {formatDate(app.submittedOn)}
          </span>
          <button
            type="button"
            {...listeners}
            {...attributes}
            aria-label={`Drag ${app.code}`}
            className="cursor-grab rounded-[4px] p-0.5 text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#204CD3]"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Middle row: Target Role (headline-sm, 1-line truncation) + Compensation label (tabular text) */}
      <div className="mt-2">
        <Link
          href={`/applications/${app.id}`}
          className="text-headline-sm block truncate text-[#0F172A] hover:text-[#204CD3] dark:text-slate-100"
        >
          {app.vacancy.title}
        </Link>

        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/applications/${app.id}`}
              className="font-mono text-[11px] font-semibold text-[#204CD3] tabular-nums hover:underline dark:text-[#B7C4FF]"
            >
              {app.code}
            </Link>
            {app.isSample && <SampleBadge />}
          </div>

          {app.expectedSalary != null && (
            <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#334155] tabular-nums dark:bg-slate-800 dark:text-slate-300">
              {formatMoney(app.expectedSalary, app.currency, true)}
            </span>
          )}
        </div>
      </div>

      {/* Bottom row: Status Pill Badge (left-aligned) + Interview step pill or follow-up indicator (right-aligned) */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5">
        <StageBadge name={app.stage.name} color={app.stage.color} />

        {app.nextInterview ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-semibold text-[#047857] tabular-nums dark:bg-emerald-950/60 dark:text-emerald-300">
            <Calendar className="h-3 w-3" />
            {formatDate(app.nextInterview.startsAt)}
          </span>
        ) : (
          <OutcomeBadge outcome={app.outcome} />
        )}
      </div>

      {app.nextFollowUpOn && app.outcome === "active" && (
        <p className="mt-2 text-[11px] text-[#64748B] tabular-nums">
          Next follow-up:{" "}
          <span className="font-mono font-medium text-[#334155] dark:text-slate-300">
            {formatDate(app.nextFollowUpOn)}
          </span>
        </p>
      )}

      {app.noResponseSuggestion.shouldSuggest && noResponseStage && (
        <div className="mt-2 rounded-[4px] border border-[#F59E0B]/40 bg-[#FFFBEB] p-2 text-[11px] text-[#B45309] dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-center gap-1 font-semibold tabular-nums">
            <Clock className="h-3 w-3 shrink-0" />
            <span>No response for {app.noResponseSuggestion.silentDays}d</span>
          </div>
          <button
            type="button"
            onClick={onConfirmNoResponse}
            className="mt-1 font-semibold underline"
          >
            Confirm &ldquo;No Response&rdquo;
          </button>
        </div>
      )}

      {/* Accessible Move Stage Selector (works on touch, mobile, and keyboard) */}
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[#E2E8F0] pt-2 dark:border-slate-800">
        <label
          htmlFor={`move-${app.id}`}
          className="text-[11px] font-semibold text-[#64748B]"
        >
          Move stage:
        </label>
        <select
          id={`move-${app.id}`}
          aria-label={`Move stage for ${app.code}`}
          disabled={disabled}
          value={app.currentStageId}
          onChange={(e) => onMoveTo(e.target.value)}
          className="max-w-[155px] truncate rounded-[4px] border border-[#CBD5E1] bg-[#F8FAFC] px-2 py-0.5 text-[11px] font-semibold text-[#334155] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          {appStages.map((st) => (
            <option key={st.id} value={st.id}>
              {st.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
