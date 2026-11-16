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
      {/* Header Breadcrumb & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#3f674f] dark:text-[#a5d1b4]">
            <span>Pipeline Intelligence</span>
            <span>/</span>
            <span className="text-[#006a42] dark:text-[#69dca0]">
              Active Search Cycle
            </span>
          </div>
          <h1 className="text-headline-md text-[#171d19] dark:text-[#ecf3eb]">
            Application Tracking & Pipeline
          </h1>
          <p className="mt-0.5 text-[13px] text-[#3f674f] dark:text-[#a5d1b4]">
            Manage submitted job applications across HR recruitment stages via
            Kanban Board or Data Table.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Segmented Control matching Stitch HTML 1 */}
          <div className="inline-flex rounded-xl bg-[#eff5ee] p-1 dark:bg-[#17231c]">
            <button
              type="button"
              onClick={() => switchView("board")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                view === "board"
                  ? "bg-[#ffffff] text-[#171d19] shadow-sm dark:bg-[#006a42] dark:text-white"
                  : "text-[#3f674f] hover:text-[#171d19] dark:text-[#a5d1b4] dark:hover:text-white"
              }`}
            >
              <Kanban
                className={`h-3.5 w-3.5 ${
                  view === "board" ? "text-[#006a42] dark:text-white" : ""
                }`}
              />
              Kanban Board
            </button>
            <button
              type="button"
              onClick={() => switchView("table")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                view === "table"
                  ? "bg-[#ffffff] text-[#171d19] shadow-sm dark:bg-[#006a42] dark:text-white"
                  : "text-[#3f674f] hover:text-[#171d19] dark:text-[#a5d1b4] dark:hover:text-white"
              }`}
            >
              <Table
                className={`h-3.5 w-3.5 ${
                  view === "table" ? "text-[#006a42] dark:text-white" : ""
                }`}
              />
              Data Table
            </button>
          </div>

          <a
            href={exportUrl}
            download
            className="btn-secondary h-10 px-4 text-xs"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </a>

          <button
            type="button"
            onClick={() => setManualNewOpen(true)}
            className="btn-primary h-10 px-4 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Log Application
          </button>
        </div>
      </div>

      {/* Command & Control Filter Toolbar */}
      <div className="elevation-1 grid grid-cols-1 gap-2.5 rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-3.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 dark:border-[#24332a] dark:bg-[#111a15]">
        <div className="relative min-w-0 sm:col-span-2 lg:col-span-2 xl:col-span-2">
          <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-[#3f674f] dark:text-[#a5d1b4]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, position, APP ID, recruiter..."
            className="h-10 w-full min-w-0 rounded-xl border border-transparent bg-[#eff5ee] pr-3 pl-9 text-xs text-[#171d19] outline-none placeholder:text-[#3f674f] focus:border-[#006a42] focus:bg-[#ffffff] dark:bg-[#17231c] dark:text-[#ecf3eb] dark:placeholder:text-[#a5d1b4]"
          />
        </div>

        <select
          aria-label="Filter by stage"
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="h-10 w-full min-w-0 rounded-xl border border-transparent bg-[#eff5ee] px-3 text-xs font-medium text-[#171d19] dark:bg-[#17231c] dark:text-[#ecf3eb]"
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
          className="h-10 w-full min-w-0 rounded-xl border border-transparent bg-[#eff5ee] px-3 text-xs font-medium text-[#171d19] dark:bg-[#17231c] dark:text-[#ecf3eb]"
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
          className="h-10 w-full min-w-0 rounded-xl border border-transparent bg-[#eff5ee] px-3 text-xs font-medium text-[#171d19] sm:col-span-2 lg:col-span-2 xl:col-span-1 dark:bg-[#17231c] dark:text-[#ecf3eb]"
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
            className="h-10 w-full min-w-0 rounded-xl border border-transparent bg-[#eff5ee] px-2.5 text-[11px] font-medium text-[#171d19] tabular-nums dark:bg-[#17231c] dark:text-[#ecf3eb]"
          />
          <input
            type="date"
            aria-label="Submitted to date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-10 w-full min-w-0 rounded-xl border border-transparent bg-[#eff5ee] px-2.5 text-[11px] font-medium text-[#171d19] tabular-nums dark:bg-[#17231c] dark:text-[#ecf3eb]"
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
