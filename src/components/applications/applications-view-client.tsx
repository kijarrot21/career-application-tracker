"use client";

import { Download, Kanban, Plus, Search, Table } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ApplicationsTable } from "@/components/applications/applications-table";
import { ContextualHelp } from "@/components/help/contextual-help";
import { KanbanBoard } from "@/components/applications/kanban-board";
import {
  RecordSubmissionDialog,
  type VacancyOptionForSubmission,
} from "@/components/applications/record-submission-dialog";
import { Button, Card, Input, PageHeader, Select } from "@/components/ui";
import {
  isVacancyLevel,
  OUTCOME_LABELS,
  OUTCOMES,
  type Outcome,
} from "@/lib/domain/stages";
import { cn } from "@/lib/utils";
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
      <PageHeader
        breadcrumbs={[
          { label: "Pipeline Intelligence", href: "/dashboard" },
          { label: "Active Search Cycle" },
        ]}
        title="Application Tracking & Pipeline"
        description="Manage submitted job applications across HR recruitment stages via Kanban Board or Data Table."
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <ContextualHelp module="applications" />
            <div className="inline-flex rounded-xl bg-surface-subtle p-1">
              <button
                type="button"
                onClick={() => switchView("board")}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                  view === "board"
                    ? "bg-card text-foreground shadow-xs dark:bg-primary dark:text-white"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Kanban
                  className={cn(
                    "h-3.5 w-3.5",
                    view === "board" && "text-primary-text dark:text-white",
                  )}
                />
                Kanban Board
              </button>
              <button
                type="button"
                onClick={() => switchView("table")}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                  view === "table"
                    ? "bg-card text-foreground shadow-xs dark:bg-primary dark:text-white"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Table
                  className={cn(
                    "h-3.5 w-3.5",
                    view === "table" && "text-primary-text dark:text-white",
                  )}
                />
                Data Table
              </button>
            </div>

            <Button variant="secondary" size="lg" asChild>
              <a href={exportUrl} download>
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </a>
            </Button>

            <Button
              variant="primary"
              size="lg"
              onClick={() => setManualNewOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Log Application
            </Button>
          </div>
        }
      />

      {/* Command & Control Filter Toolbar */}
      <Card
        padding="sm"
        className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"
      >
        <div className="relative min-w-0 sm:col-span-2 lg:col-span-2 xl:col-span-2">
          <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            inputSize="lg"
            tone="subtle"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search applications"
            placeholder="Search company, position, APP ID, recruiter..."
            className="pl-9"
          />
        </div>

        <Select
          aria-label="Filter by stage"
          selectSize="lg"
          tone="subtle"
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
        >
          <option value="all">All Stages</option>
          {appStages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Filter by outcome"
          selectSize="lg"
          tone="subtle"
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value as Outcome | "all")}
        >
          <option value="all">All Outcomes</option>
          {OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {OUTCOME_LABELS[o]}
            </option>
          ))}
        </Select>

        <Select
          aria-label="Filter by platform"
          selectSize="lg"
          tone="subtle"
          wrapperClassName="sm:col-span-2 lg:col-span-2 xl:col-span-1"
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
        >
          <option value="all">All Platforms</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>

        <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:col-span-2 lg:col-span-2 xl:col-span-2">
          <Input
            type="date"
            inputSize="lg"
            tone="subtle"
            aria-label="Submitted from date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-2.5 text-[11px] tabular-nums"
          />
          <Input
            type="date"
            inputSize="lg"
            tone="subtle"
            aria-label="Submitted to date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-2.5 text-[11px] tabular-nums"
          />
        </div>
      </Card>

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
