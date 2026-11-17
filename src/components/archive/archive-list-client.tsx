"use client";

import {
  Archive,
  Eye,
  FileText,
  RotateCcw,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  ArchiveOutcomeBadge,
  ManualArchiveDialog,
  ReapplyFromArchiveDialog,
  RestoreArchiveDialog,
  RetentionPolicyDialog,
} from "@/components/archive/archive-dialogs";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  Input,
  PageHeader,
  SampleBadge,
  Select,
  type DataTableColumn,
} from "@/components/ui";
import {
  ARCHIVE_OUTCOME_LABELS,
  ARCHIVE_OUTCOMES,
  type ArchiveOutcome,
  type ClosureRecordStatus,
} from "@/lib/domain/archive";
import { formatDate } from "@/lib/format";
import type {
  listArchivableApplications,
  listArchivedApplications,
} from "@/server/queries/archive";

type ArchiveListData = Awaited<ReturnType<typeof listArchivedApplications>>;
type ArchiveItem = ArchiveListData["items"][number];
type ArchivableApp = Awaited<ReturnType<typeof listArchivableApplications>>[number];

export function ArchiveListClient({
  data,
  archivableApps,
  activeStages,
  defaultCurrency,
}: {
  data: ArchiveListData;
  archivableApps: ArchivableApp[];
  activeStages: { id: string; name: string }[];
  defaultCurrency: string;
}) {
  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<ArchiveOutcome | "all">("all");
  const [companyFilter, setCompanyFilter] = useState("");
  const [jobTitleFilter, setJobTitleFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClosureRecordStatus | "all">(
    "archived",
  );
  const [sortKey, setSortKey] = useState<"closedOn" | "company" | "code">(
    "closedOn",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [retentionDialogOpen, setRetentionDialogOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<ArchiveItem | null>(null);
  const [reapplyTarget, setReapplyTarget] = useState<ArchiveItem | null>(null);

  const filtered = data.items
    .filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (
        outcomeFilter !== "all" &&
        item.closureOutcome !== outcomeFilter
      ) {
        return false;
      }
      if (
        companyFilter.trim() &&
        !item.snapshot.companyName
          .toLowerCase()
          .includes(companyFilter.trim().toLowerCase())
      ) {
        return false;
      }
      if (
        jobTitleFilter.trim() &&
        !item.snapshot.jobTitle
          .toLowerCase()
          .includes(jobTitleFilter.trim().toLowerCase())
      ) {
        return false;
      }
      if (fromDate && item.closedOn < fromDate) return false;
      if (toDate && item.closedOn > toDate) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hit =
          item.snapshot.applicationCode.toLowerCase().includes(q) ||
          item.snapshot.companyName.toLowerCase().includes(q) ||
          item.snapshot.jobTitle.toLowerCase().includes(q) ||
          (item.closureReason ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "closedOn") {
        cmp = a.closedOn.localeCompare(b.closedOn);
      } else if (sortKey === "company") {
        cmp = a.snapshot.companyName.localeCompare(b.snapshot.companyName);
      } else {
        cmp = a.snapshot.applicationCode.localeCompare(
          b.snapshot.applicationCode,
        );
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

  function handleSort(key: string) {
    const typed = key as "closedOn" | "company" | "code";
    if (sortKey === typed) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(typed);
      setSortDir(typed === "closedOn" ? "desc" : "asc");
    }
  }

  function resetFilters() {
    setSearch("");
    setOutcomeFilter("all");
    setCompanyFilter("");
    setJobTitleFilter("");
    setFromDate("");
    setToDate("");
    setStatusFilter("archived");
  }

  const columns: DataTableColumn<ArchiveItem>[] = [
    {
      key: "code",
      header: "Application",
      sortKey: "code",
      render: (item) => (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={`/archive/${item.id}`}
              className="font-mono font-semibold text-primary-text hover:underline tabular-nums"
            >
              {item.snapshot.applicationCode}
            </Link>
            {item.snapshot.attemptNumber > 1 && (
              <Badge variant="outline">#{item.snapshot.attemptNumber}</Badge>
            )}
            {item.isSample && <SampleBadge />}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Submitted {formatDate(item.snapshot.submittedOn)}
          </p>
        </div>
      ),
    },
    {
      key: "company",
      header: "Company & Position",
      sortKey: "company",
      render: (item) => (
        <div className="min-w-0 max-w-xs space-y-0.5">
          <Link
            href={`/archive/${item.id}`}
            className="block truncate font-semibold text-foreground hover:text-primary-text"
          >
            {item.snapshot.jobTitle}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {item.snapshot.companyName}
          </p>
          {item.closureReason && (
            <p className="truncate text-[11px] text-subtle-foreground">
              {item.closureReason}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "outcome",
      header: "Closure Outcome",
      render: (item) => (
        <div className="space-y-1">
          <ArchiveOutcomeBadge outcome={item.closureOutcome} />
          {item.status === "restored" && (
            <div>
              <Badge variant="info">Restored to Active</Badge>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "closedOn",
      header: "Closed On",
      sortKey: "closedOn",
      render: (item) => (
        <div className="space-y-0.5 tabular-nums">
          <span className="block font-medium text-foreground">
            {formatDate(item.closedOn)}
          </span>
          <span className="block text-[11px] text-muted-foreground">
            Snapshot v{item.snapshot.snapshotVersion}
          </span>
        </div>
      ),
    },
    {
      key: "docs",
      header: "Preserved Docs",
      render: (item) => (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
          <FileText className="h-3.5 w-3.5 text-primary-text" />
          {item.documentsCount}
        </span>
      ),
    },
    {
      key: "retention",
      header: "Retention",
      render: (item) => {
        if (!item.retainUntil) {
          return <Badge variant="secondary">Indefinite</Badge>;
        }
        if (item.retentionState === "expired") {
          return (
            <Badge variant="destructive">
              Expired ({formatDate(item.retainUntil)})
            </Badge>
          );
        }
        if (item.retentionState === "expiring_soon") {
          return (
            <Badge variant="warning">
              Until {formatDate(item.retainUntil)}
            </Badge>
          );
        }
        return (
          <span className="text-xs text-muted-foreground tabular-nums">
            Until {formatDate(item.retainUntil)}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (item) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/archive/${item.id}`}>
              <Eye className="h-3.5 w-3.5" />
              Snapshot
            </Link>
          </Button>
          {item.status === "archived" &&
            !item.hasActiveApplicationForVacancy && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRestoreTarget(item)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restore
              </Button>
            )}
          {!item.hasActiveApplicationForVacancy && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setReapplyTarget(item)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Re-apply
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        breadcrumbs={[
          { label: "Pipeline Intelligence", href: "/dashboard" },
          { label: "Application Archive" },
        ]}
        title="Application Archive & Immutable Snapshots"
        description="Inspect historical closures, preserved CV/document versions, restore incorrect archivals, or re-apply intentionally while keeping original application records intact."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setRetentionDialogOpen(true)}
            >
              <Settings2 className="h-4 w-4" />
              Retention Policy
            </Button>
            <Button
              onClick={() => setArchiveDialogOpen(true)}
              disabled={archivableApps.length === 0}
            >
              <Archive className="h-4 w-4" />
              Archive Application
            </Button>
          </div>
        }
      />

      {/* Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="p-3.5">
          <p className="text-label-xs uppercase text-muted-foreground">
            Archived Total
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
            {data.stats.totalArchived}
          </p>
        </Card>
        <Card className="p-3.5">
          <p className="text-label-xs uppercase text-muted-foreground">
            Rejected
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-destructive-on-soft tabular-nums">
            {data.stats.rejectedCount}
          </p>
        </Card>
        <Card className="p-3.5">
          <p className="text-label-xs uppercase text-muted-foreground">
            Withdrawn
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
            {data.stats.withdrawnCount}
          </p>
        </Card>
        <Card className="p-3.5">
          <p className="text-label-xs uppercase text-muted-foreground">Hired</p>
          <p className="mt-1 font-display text-2xl font-bold text-success-on-soft tabular-nums">
            {data.stats.hiredCount}
          </p>
        </Card>
        <Card className="p-3.5">
          <p className="text-label-xs uppercase text-muted-foreground">
            No Response
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-warning-on-soft tabular-nums">
            {data.stats.noResponseCount}
          </p>
        </Card>
        <Card className="p-3.5">
          <p className="text-label-xs uppercase text-muted-foreground">
            Closed
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-info-on-soft tabular-nums">
            {data.stats.closedCount}
          </p>
        </Card>
      </div>

      {/* Immutability & Retention Notice */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface-subtle px-4 py-2.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary-text" />
          <span>
            Auto-archive on terminal stage is{" "}
            <strong className="text-foreground">
              {data.retentionPolicy.autoArchiveOnTerminal ? "Enabled" : "Disabled"}
            </strong>
            . Retention:{" "}
            <strong className="text-foreground">
              {data.retentionPolicy.archiveRetentionDays
                ? `${data.retentionPolicy.archiveRetentionDays} days`
                : "Indefinite"}
            </strong>
            . Snapshots are SHA-256 hashed and immutable.
          </span>
        </div>
        {data.stats.expiredCount > 0 && (
          <Button
            variant="warning"
            size="sm"
            onClick={() => setRetentionDialogOpen(true)}
          >
            {data.stats.expiredCount} Expired: Review Retention
          </Button>
        )}
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-subtle-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, company, role, reason..."
              aria-label="Search archived applications"
              className="pl-8"
            />
          </div>

          <Select
            value={outcomeFilter}
            onChange={(e) =>
              setOutcomeFilter(e.target.value as ArchiveOutcome | "all")
            }
            aria-label="Filter by closure outcome"
          >
            <option value="all">All outcomes</option>
            {ARCHIVE_OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {ARCHIVE_OUTCOME_LABELS[o]}
              </option>
            ))}
          </Select>

          <Input
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            placeholder="Filter company..."
            aria-label="Filter by company"
          />

          <Input
            value={jobTitleFilter}
            onChange={(e) => setJobTitleFilter(e.target.value)}
            placeholder="Filter job title..."
            aria-label="Filter by job title"
          />

          <Select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as ClosureRecordStatus | "all")
            }
            aria-label="Filter by archive status"
          >
            <option value="archived">Currently Archived</option>
            <option value="restored">Restored Records</option>
            <option value="all">All Archive History</option>
          </Select>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">Closed date:</span>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              aria-label="Closure date from"
              className="h-8 w-auto"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              aria-label="Closure date to"
              className="h-8 w-auto"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Reset Filters
          </Button>
        </div>
      </Card>

      {/* Archive Table or Empty State */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="No archived applications match your filters"
          description="Applications moved to Rejected, Withdrawn, Hired, No Response, or manually Closed appear here with immutable historical snapshots."
          action={
            archivableApps.length > 0 ? (
              <Button onClick={() => setArchiveDialogOpen(true)}>
                <Archive className="h-4 w-4" />
                Archive an Application
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          rowKey={(item) => item.id}
          sortKey={sortKey}
          sortDirection={sortDir}
          onSort={handleSort}
        />
      )}

      {/* Dialogs */}
      {archiveDialogOpen && (
        <ManualArchiveDialog
          open={archiveDialogOpen}
          onClose={() => setArchiveDialogOpen(false)}
          applications={archivableApps}
        />
      )}

      {retentionDialogOpen && (
        <RetentionPolicyDialog
          open={retentionDialogOpen}
          onClose={() => setRetentionDialogOpen(false)}
          policy={data.retentionPolicy}
          expiredCount={data.stats.expiredCount}
        />
      )}

      {restoreTarget && (
        <RestoreArchiveDialog
          open={Boolean(restoreTarget)}
          onClose={() => setRestoreTarget(null)}
          closureRecordId={restoreTarget.id}
          applicationCode={restoreTarget.snapshot.applicationCode}
          stages={activeStages}
          defaultStageId={restoreTarget.previousStageId}
        />
      )}

      {reapplyTarget && (
        <ReapplyFromArchiveDialog
          open={Boolean(reapplyTarget)}
          onClose={() => setReapplyTarget(null)}
          closureRecordId={reapplyTarget.id}
          applicationCode={reapplyTarget.snapshot.applicationCode}
          companyName={reapplyTarget.snapshot.companyName}
          jobTitle={reapplyTarget.snapshot.jobTitle}
          defaultCurrency={defaultCurrency}
        />
      )}
    </div>
  );
}
