"use client";

import { Download, Kanban, Plus, Search, Table } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ApplicationsTable } from "@/components/applications/applications-table";
import { KanbanBoard } from "@/components/applications/kanban-board";
import {
  RecordSubmissionDialog,
  type VacancyOptionForSubmission,
} from "@/components/applications/record-submission-dialog";
import {
  isVacancyLevel,
  OUTCOME_LABELS,
  OUTCOMES,
  type Outcome,
} from "@/lib/domain/stages";
import type { getKanbanBoardData } from "@/server/queries/applications";

type BoardData = Awaited<ReturnType<typeof getKanbanBoardData>>;

export function ApplicationsViewClient({
  boardData,
  vacancyOptions,
  sources,
  defaultCurrency,
  initialView,
  initialOpenNew,
}: {
  boardData: BoardData;
  vacancyOptions: VacancyOptionForSubmission[];
  sources: { id: string; key: string; name: string }[];
  defaultCurrency: string;
  initialView: "board" | "table";
  initialOpenNew?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlView = searchParams.get("view");
  const [viewOverride, setViewOverride] = useState<"board" | "table" | null>(
    null,
  );
  const view: "board" | "table" =
    viewOverride ??
    (urlView === "table" || urlView === "board" ? urlView : initialView);

  const [manualNewOpen, setManualNewOpen] = useState(Boolean(initialOpenNew));
  const newOpen = manualNewOpen || searchParams.get("new") === "1";

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<Outcome | "all">("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const appStages = boardData.stages.filter(
    (s) => !isVacancyLevel(s.stageType),
  );

  const filteredApps = boardData.applications.filter((a) => {
    if (stageFilter !== "all" && a.currentStageId !== stageFilter) return false;
    if (outcomeFilter !== "all" && a.outcome !== outcomeFilter) return false;
    if (platformFilter !== "all" && a.platformSourceId !== platformFilter)
      return false;
    if (fromDate && a.submittedOn < fromDate) return false;
    if (toDate && a.submittedOn > toDate) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        a.code.toLowerCase().includes(q) ||
        a.vacancy.title.toLowerCase().includes(q) ||
        a.company.name.toLowerCase().includes(q) ||
        (a.recruiterName ?? "").toLowerCase().includes(q) ||
        (a.jobCategory ?? "").toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const filteredVacancies = boardData.unappliedVacancies.filter((v) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      v.code.toLowerCase().includes(q) ||
      v.title.toLowerCase().includes(q) ||
      v.company.name.toLowerCase().includes(q)
    );
  });

  const exportParams = new URLSearchParams();
  if (search.trim()) exportParams.set("search", search.trim());
  if (stageFilter !== "all") exportParams.set("stageId", stageFilter);
  if (outcomeFilter !== "all") exportParams.set("outcome", outcomeFilter);
  if (platformFilter !== "all")
    exportParams.set("platformSourceId", platformFilter);
  if (fromDate) exportParams.set("fromDate", fromDate);
  if (toDate) exportParams.set("toDate", toDate);
  const exportUrl = `/api/export/applications${
    exportParams.toString() ? `?${exportParams.toString()}` : ""
  }`;

  function switchView(nextView: "board" | "table") {
    setViewOverride(nextView);
    router.replace(`/applications?view=${nextView}`, { scroll: false });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-headline-md text-[#0F172A] dark:text-slate-100">
            Application Tracking & Pipeline
          </h1>
          <p className="text-[13px] text-[#64748B]">
            Manage submitted job applications across HR recruitment stages via
            Kanban Board or Data Table.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] p-0.5 dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => switchView("board")}
              className={`inline-flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 text-xs font-semibold transition-colors ${
                view === "board"
                  ? "bg-[#204CD3] text-white"
                  : "text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#204CD3] dark:text-slate-400"
              }`}
            >
              <Kanban className="h-3.5 w-3.5" />
              Kanban Board
            </button>
            <button
              type="button"
              onClick={() => switchView("table")}
              className={`inline-flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 text-xs font-semibold transition-colors ${
                view === "table"
                  ? "bg-[#204CD3] text-white"
                  : "text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#204CD3] dark:text-slate-400"
              }`}
            >
              <Table className="h-3.5 w-3.5" />
              Data Table
            </button>
          </div>

          <a
            href={exportUrl}
            download
            className="inline-flex h-9 items-center gap-1.5 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-3 text-xs font-semibold text-[#0F172A] transition-colors hover:border-[#94A3B8] hover:bg-[#F8FAFC] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </a>

          <button
            type="button"
            onClick={() => setManualNewOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-[4px] bg-[#204CD3] px-3.5 text-xs font-semibold text-white transition-all hover:bg-[#1D4ED8] active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5" />
            Log Application
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="elevation-1 grid grid-cols-1 gap-2.5 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-3.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 dark:border-slate-800 dark:bg-slate-900">
        <div className="relative min-w-0 sm:col-span-2 lg:col-span-2 xl:col-span-2">
          <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-[#94A3B8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, position, APP ID, recruiter..."
            className="h-10 w-full min-w-0 rounded-[4px] border border-[#CBD5E1] bg-[#F8FAFC] pr-3 pl-9 text-xs text-[#0F172A] outline-none placeholder:text-[#64748B] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>

        <select
          aria-label="Filter by stage"
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="h-10 w-full min-w-0 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="all">All Stages</option>
          {appStages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by outcome"
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value as Outcome | "all")}
          className="h-10 w-full min-w-0 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="all">All Outcomes</option>
          {OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {OUTCOME_LABELS[o]}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by platform"
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="h-10 w-full min-w-0 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs text-[#0F172A] sm:col-span-2 lg:col-span-2 xl:col-span-1 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        >
          <option value="all">All Platforms</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:col-span-2 lg:col-span-2 xl:col-span-2">
          <input
            type="date"
            aria-label="Submitted from date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-10 w-full min-w-0 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-[11px] text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <input
            type="date"
            aria-label="Submitted to date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-10 w-full min-w-0 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2 text-[11px] text-[#0F172A] tabular-nums dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>
      </div>

      {view === "board" ? (
        <KanbanBoard
          stages={boardData.stages}
          applications={filteredApps}
          unappliedVacancies={filteredVacancies}
          sources={sources}
          defaultCurrency={defaultCurrency}
          onQuickAdd={() => setManualNewOpen(true)}
        />
      ) : (
        <ApplicationsTable
          applications={filteredApps}
          exportUrl={exportUrl}
        />
      )}

      <RecordSubmissionDialog
        open={newOpen}
        onClose={() => {
          setManualNewOpen(false);
          if (searchParams.get("new") === "1") {
            router.replace(`/applications?view=${view}`, { scroll: false });
          }
        }}
        vacancyOptions={vacancyOptions}
        sources={sources}
        defaultCurrency={defaultCurrency}
        onCreated={(appId) => {
          setManualNewOpen(false);
          router.push(`/applications/${appId}`);
        }}
      />
    </div>
  );
}
