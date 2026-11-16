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
      <div className="flex gap-1.5 overflow-x-auto rounded-xl bg-[#eff5ee] p-1 md:hidden dark:bg-[#17231c]">
        <button
          type="button"
          onClick={() => setMobileLaneId("all")}
          className={cn(
            "shrink-0 rounded-lg px-3 py-1 text-[11px] font-semibold transition-all",
            mobileLaneId === "all"
              ? "bg-[#006a42] text-white shadow-sm"
              : "text-[#3f674f] hover:text-[#171d19]",
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
              "shrink-0 rounded-lg px-3 py-1 text-[11px] font-semibold transition-all",
              mobileLaneId === st.id
                ? "bg-[#006a42] text-white shadow-sm"
                : "text-[#3f674f] hover:text-[#171d19]",
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
        "flex w-[312px] min-w-[290px] max-w-[340px] shrink-0 snap-start flex-col rounded-2xl p-3 transition-colors",
        hiddenOnMobile && "hidden md:flex",
        isOver
          ? "bg-[#c0edcf]/45 ring-2 ring-[#006a42]/40 dark:bg-[#006a42]/20"
          : "bg-[#eff5ee] dark:bg-[#17231c]/80",
      )}
    >
      <div className="mb-3 flex items-center justify-between px-1 py-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} />
            <h3 className="truncate font-display text-[15px] font-semibold tracking-[-0.01em] text-[#171d19] dark:text-[#ecf3eb]">
              {stage.name}
            </h3>
            <span className="rounded-full bg-[#dde4dd] px-2 py-0.5 font-mono text-[11px] font-bold text-[#171d19] tabular-nums dark:bg-[#23342a] dark:text-[#ecf3eb]">
              {count}
            </span>
          </div>
          {subtitle && (
            <p className="mt-0.5 text-[11px] text-[#3f674f] dark:text-[#a5d1b4]">
              {subtitle}
            </p>
          )}
        </div>

        {onQuickAdd && (
          <button
            type="button"
            onClick={onQuickAdd}
            title={`Quick add to ${stage.name}`}
            aria-label={`Quick add to ${stage.name}`}
            className="rounded-lg p-1 text-[#3f674f] transition-colors hover:bg-[#e3eae3] hover:text-[#171d19] dark:text-[#a5d1b4] dark:hover:bg-[#23342a]"
          >
            <Plus className="h-4 w-4" />
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
        "group rounded-xl border border-[#bdcabf]/40 bg-[#ffffff] p-4 text-[13px] leading-[18px] transition-all hover:-translate-y-0.5 dark:border-[#24332a] dark:bg-[#111a15]",
        isDragging ? "elevation-3 z-20" : "elevation-2",
      )}
    >
      {/* Top row: Company avatar + Company Name + Date Added */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#2b322d] font-display text-[12px] font-bold text-[#ecf3eb] dark:bg-[#23342a]">
            {getCompanyInitials(vacancy.company.name)}
          </span>
          <div className="min-w-0">
            <span className="block truncate text-[13px] font-semibold text-[#171d19] dark:text-[#ecf3eb]">
              {vacancy.company.name}
            </span>
            <span className="font-mono text-[11px] text-[#3f674f] tabular-nums dark:text-[#a5d1b4]">
              {formatDate(vacancy.discoveredOn)}
            </span>
          </div>
        </div>
        <button
          type="button"
          {...listeners}
          {...attributes}
          aria-label={`Drag ${vacancy.title}`}
          className="cursor-grab rounded-lg p-1 text-[#6e7a71] opacity-70 transition-opacity hover:bg-[#eff5ee] hover:text-[#006a42] group-hover:opacity-100"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Middle row: Target Role + Code */}
      <div className="mt-3">
        <Link
          href={`/jobs/${vacancy.id}`}
          className="block truncate font-display text-[15px] font-semibold text-[#171d19] transition-colors group-hover:text-[#006a42] dark:text-[#ecf3eb] dark:group-hover:text-[#69dca0]"
        >
          {vacancy.title}
        </Link>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[11px] text-[#3f674f] tabular-nums dark:text-[#a5d1b4]">
            {vacancy.code}
          </span>
          {vacancy.isSample && <SampleBadge />}
        </div>
      </div>

      {/* Bottom row: Suitability Pill Badge + Apply action */}
      <div className="mt-3 flex items-center justify-between pt-2">
        <SuitabilityBadge score={vacancy.suitabilityScore} />
        <button
          type="button"
          onClick={onRecordApply}
          className="inline-flex items-center gap-1 rounded-lg bg-[#c0edcf] px-2.5 py-1 text-[11px] font-semibold text-[#005232] transition-colors hover:bg-[#006a42] hover:text-white dark:bg-[#005232] dark:text-[#86f9ba]"
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
        "group rounded-xl border border-[#bdcabf]/40 bg-[#ffffff] p-4 text-[13px] leading-[18px] transition-all hover:-translate-y-0.5 dark:border-[#24332a] dark:bg-[#111a15]",
        isDragging ? "elevation-3 z-20" : "elevation-2",
      )}
    >
      {/* Top row: Company avatar + Company Name + Date Added */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#006a42] font-display text-[12px] font-bold text-white">
            {getCompanyInitials(app.company.name)}
          </span>
          <div className="min-w-0">
            <span className="block truncate text-[13px] font-semibold text-[#171d19] dark:text-[#ecf3eb]">
              {app.company.name}
            </span>
            <span className="font-mono text-[11px] text-[#3f674f] tabular-nums dark:text-[#a5d1b4]">
              {formatDate(app.submittedOn)}
            </span>
          </div>
        </div>
        <button
          type="button"
          {...listeners}
          {...attributes}
          aria-label={`Drag ${app.code}`}
          className="cursor-grab rounded-lg p-1 text-[#6e7a71] opacity-70 transition-opacity hover:bg-[#eff5ee] hover:text-[#006a42] group-hover:opacity-100"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Middle row: Target Role + Code + Compensation pill */}
      <div className="mt-3">
        <Link
          href={`/applications/${app.id}`}
          className="block truncate font-display text-[15px] font-semibold text-[#171d19] transition-colors group-hover:text-[#006a42] dark:text-[#ecf3eb] dark:group-hover:text-[#69dca0]"
        >
          {app.vacancy.title}
        </Link>

        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/applications/${app.id}`}
              className="font-mono text-[11px] font-semibold text-[#006a42] tabular-nums hover:underline dark:text-[#69dca0]"
            >
              {app.code}
            </Link>
            {app.isSample && <SampleBadge />}
          </div>

          {app.expectedSalary != null && (
            <span className="rounded-full bg-[#e3eae3] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[#3e4a41] tabular-nums dark:bg-[#1d2b23] dark:text-[#b7c6ba]">
              {formatMoney(app.expectedSalary, app.currency, true)}
            </span>
          )}
        </div>
      </div>

      {/* Bottom row: Status Pill Badge + Interview step pill */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5">
        <StageBadge name={app.stage.name} color={app.stage.color} />

        {app.nextInterview ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#86f9ba]/70 px-2.5 py-0.5 text-[11px] font-semibold text-[#002111] tabular-nums dark:bg-emerald-950/60 dark:text-emerald-300">
            <Calendar className="h-3 w-3" />
            {formatDate(app.nextInterview.startsAt)}
          </span>
        ) : (
          <OutcomeBadge outcome={app.outcome} />
        )}
      </div>

      {app.nextFollowUpOn && app.outcome === "active" && (
        <p className="mt-2.5 text-[11px] text-[#3f674f] tabular-nums dark:text-[#a5d1b4]">
          Next follow-up:{" "}
          <span className="font-mono font-semibold text-[#171d19] dark:text-[#ecf3eb]">
            {formatDate(app.nextFollowUpOn)}
          </span>
        </p>
      )}

      {app.noResponseSuggestion.shouldSuggest && noResponseStage && (
        <div className="mt-2.5 rounded-xl border border-[#e8c084] bg-[#ffdead]/60 p-2.5 text-[11px] text-[#5d4211] dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
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

      {/* Accessible Move Stage Selector */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#e3eae3] pt-2.5 dark:border-[#24332a]">
        <label
          htmlFor={`move-${app.id}`}
          className="text-[11px] font-semibold text-[#3f674f] dark:text-[#a5d1b4]"
        >
          Move stage:
        </label>
        <select
          id={`move-${app.id}`}
          aria-label={`Move stage for ${app.code}`}
          disabled={disabled}
          value={app.currentStageId}
          onChange={(e) => onMoveTo(e.target.value)}
          className="max-w-[155px] truncate rounded-lg border border-[#bdcabf]/60 bg-[#eff5ee] px-2 py-1 text-[11px] font-semibold text-[#171d19] dark:border-[#2d3d33] dark:bg-[#17231c] dark:text-[#ecf3eb]"
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
