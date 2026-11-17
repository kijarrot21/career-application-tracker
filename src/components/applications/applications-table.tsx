"use client";

import { Download } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  Button,
  Card,
  DataTableBody,
  DataTableCell,
  DataTableContainer,
  DataTableHead,
  DataTableHeader,
  DataTableRoot,
  DataTableRow,
  DataTableSortButton,
  OutcomeBadge,
  SampleBadge,
  Select,
  StageBadge,
} from "@/components/ui";
import {
  SUBMISSION_METHOD_LABELS,
  type SubmissionMethod,
} from "@/lib/constants";
import { OUTCOME_LABELS } from "@/lib/domain/stages";
import { formatDate, formatMoney } from "@/lib/format";
import type { listApplications } from "@/server/queries/applications";

type AppRow = Awaited<ReturnType<typeof listApplications>>[number];

type SortField =
  | "code"
  | "company"
  | "position"
  | "submittedOn"
  | "stage"
  | "expectedSalary";

type GroupBy = "none" | "stage" | "company" | "platform" | "outcome";

export function ApplicationsTable({
  applications,
  exportUrl,
}: {
  applications: AppRow[];
  exportUrl: string;
}) {
  const [sortField, setSortField] = useState<SortField>("submittedOn");
  const [sortAsc, setSortAsc] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>("none");

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  const direction = sortAsc ? "asc" : "desc";

  const sorted = [...applications].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case "code":
        cmp = a.code.localeCompare(b.code);
        break;
      case "company":
        cmp = a.company.name.localeCompare(b.company.name);
        break;
      case "position":
        cmp = a.vacancy.title.localeCompare(b.vacancy.title);
        break;
      case "submittedOn":
        cmp = a.submittedOn.localeCompare(b.submittedOn);
        break;
      case "stage":
        cmp = a.stage.sortOrder - b.stage.sortOrder;
        break;
      case "expectedSalary":
        cmp = (a.expectedSalary ?? 0) - (b.expectedSalary ?? 0);
        break;
    }
    return sortAsc ? cmp : -cmp;
  });

  const groups: { key: string; label: string; rows: AppRow[] }[] = [];
  if (groupBy === "none") {
    groups.push({ key: "all", label: "All Applications", rows: sorted });
  } else {
    const map = new Map<string, AppRow[]>();
    for (const row of sorted) {
      const label =
        groupBy === "stage"
          ? row.stage.name
          : groupBy === "company"
            ? row.company.name
            : groupBy === "platform"
              ? (row.platform?.name ?? "Unspecified")
              : OUTCOME_LABELS[row.outcome];
      const list = map.get(label) ?? [];
      list.push(row);
      map.set(label, list);
    }
    for (const [label, rows] of map.entries()) {
      groups.push({ key: label, label, rows });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <label
            htmlFor="applications-group-by"
            className="font-semibold text-muted-foreground"
          >
            Group rows by:
          </label>
          <Select
            id="applications-group-by"
            aria-label="Group applications by"
            selectSize="lg"
            wrapperClassName="w-44"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
          >
            <option value="none">No grouping</option>
            <option value="stage">Recruitment Stage</option>
            <option value="company">Company</option>
            <option value="platform">Platform</option>
            <option value="outcome">Outcome</option>
          </Select>
        </div>

        <Button variant="secondary" size="lg" asChild className="tabular-nums">
          <a href={exportUrl} download>
            <Download className="h-3.5 w-3.5" />
            Export CSV ({applications.length})
          </a>
        </Button>
      </div>

      {groups.map((grp) => (
        <Card key={grp.key} padding="sm" className="space-y-3">
          {groupBy !== "none" && (
            <div className="rounded-lg bg-surface-subtle px-3.5 py-2 text-xs font-semibold text-foreground tabular-nums">
              {grp.label} ({grp.rows.length})
            </div>
          )}

          <DataTableContainer className="border-0 shadow-none">
            <DataTableRoot>
              <DataTableHeader>
                <tr>
                  <DataTableHead
                    sortDirection={sortField === "code" ? direction : "none"}
                  >
                    <DataTableSortButton
                      active={sortField === "code"}
                      direction={direction}
                      onClick={() => toggleSort("code")}
                    >
                      App ID
                    </DataTableSortButton>
                  </DataTableHead>
                  <DataTableHead
                    sortDirection={sortField === "company" ? direction : "none"}
                  >
                    <DataTableSortButton
                      active={sortField === "company"}
                      direction={direction}
                      onClick={() => toggleSort("company")}
                    >
                      Company
                    </DataTableSortButton>
                  </DataTableHead>
                  <DataTableHead
                    sortDirection={sortField === "position" ? direction : "none"}
                  >
                    <DataTableSortButton
                      active={sortField === "position"}
                      direction={direction}
                      onClick={() => toggleSort("position")}
                    >
                      Position
                    </DataTableSortButton>
                  </DataTableHead>
                  <DataTableHead
                    sortDirection={sortField === "stage" ? direction : "none"}
                  >
                    <DataTableSortButton
                      active={sortField === "stage"}
                      direction={direction}
                      onClick={() => toggleSort("stage")}
                    >
                      Stage
                    </DataTableSortButton>
                  </DataTableHead>
                  <DataTableHead>Outcome</DataTableHead>
                  <DataTableHead>Platform & Method</DataTableHead>
                  <DataTableHead
                    sortDirection={
                      sortField === "submittedOn" ? direction : "none"
                    }
                  >
                    <DataTableSortButton
                      active={sortField === "submittedOn"}
                      direction={direction}
                      onClick={() => toggleSort("submittedOn")}
                    >
                      Applied On
                    </DataTableSortButton>
                  </DataTableHead>
                  <DataTableHead
                    sortDirection={
                      sortField === "expectedSalary" ? direction : "none"
                    }
                  >
                    <DataTableSortButton
                      active={sortField === "expectedSalary"}
                      direction={direction}
                      onClick={() => toggleSort("expectedSalary")}
                    >
                      Expected Salary
                    </DataTableSortButton>
                  </DataTableHead>
                  <DataTableHead>CV Used</DataTableHead>
                  <DataTableHead>Next Follow-up</DataTableHead>
                </tr>
              </DataTableHeader>
              <DataTableBody>
                {grp.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-10 text-center text-body-sm text-muted-foreground"
                    >
                      No applications match the active filters.
                    </td>
                  </tr>
                ) : (
                  grp.rows.map((app) => (
                    <DataTableRow key={app.id}>
                      <DataTableCell className="font-mono text-xs font-semibold tabular-nums">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/applications/${app.id}`}
                            className="text-primary-text hover:underline"
                          >
                            {app.code}
                          </Link>
                          {app.isSample && <SampleBadge />}
                        </div>
                      </DataTableCell>
                      <DataTableCell className="font-semibold text-foreground">
                        {app.company.name}
                      </DataTableCell>
                      <DataTableCell>
                        <Link
                          href={`/applications/${app.id}`}
                          className="font-semibold text-foreground hover:text-primary-text"
                        >
                          {app.vacancy.title}
                        </Link>
                        {app.jobCategory && (
                          <span className="block text-[11px] text-muted-foreground">
                            {app.jobCategory}
                          </span>
                        )}
                      </DataTableCell>
                      <DataTableCell>
                        <StageBadge
                          name={app.stage.name}
                          color={app.stage.color}
                        />
                      </DataTableCell>
                      <DataTableCell>
                        <OutcomeBadge outcome={app.outcome} />
                      </DataTableCell>
                      <DataTableCell className="text-muted-foreground">
                        <div className="font-medium text-foreground">
                          {app.platform?.name ?? "Direct"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {
                            SUBMISSION_METHOD_LABELS[
                              app.submissionMethod as SubmissionMethod
                            ]
                          }
                        </div>
                      </DataTableCell>
                      <DataTableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                        {formatDate(app.submittedOn)}
                      </DataTableCell>
                      <DataTableCell className="font-mono text-xs font-semibold text-foreground tabular-nums">
                        {formatMoney(app.expectedSalary, app.currency, true)}
                      </DataTableCell>
                      <DataTableCell className="text-xs text-muted-foreground">
                        {app.cvVersionLabel ?? "Not set"}
                      </DataTableCell>
                      <DataTableCell className="font-mono text-xs text-muted-foreground tabular-nums">
                        {app.nextFollowUpOn
                          ? formatDate(app.nextFollowUpOn)
                          : "None"}
                      </DataTableCell>
                    </DataTableRow>
                  ))
                )}
              </DataTableBody>
            </DataTableRoot>
          </DataTableContainer>
        </Card>
      ))}
    </div>
  );
}
