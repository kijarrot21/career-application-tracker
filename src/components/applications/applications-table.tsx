"use client";

import { ArrowUpDown, Download } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  OutcomeBadge,
  SampleBadge,
  StageBadge,
} from "@/components/ui/badges";
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
          <label className="font-medium text-[#64748B]">Group rows by:</label>
          <select
            aria-label="Group applications by"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="h-9 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-2.5 text-xs font-medium text-[#0F172A] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="none">No grouping</option>
            <option value="stage">Recruitment Stage</option>
            <option value="company">Company</option>
            <option value="platform">Platform</option>
            <option value="outcome">Outcome</option>
          </select>
        </div>

        <a
          href={exportUrl}
          download
          className="inline-flex h-9 items-center gap-1.5 rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] px-3 text-xs font-semibold text-[#0F172A] tabular-nums transition-colors hover:border-[#94A3B8] hover:bg-[#F8FAFC] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV ({applications.length})
        </a>
      </div>

      {groups.map((grp) => (
        <div
          key={grp.key}
          className="elevation-1 overflow-hidden rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] dark:border-slate-800 dark:bg-slate-900"
        >
          {groupBy !== "none" && (
            <div className="border-b border-[#E2E8F0] bg-[#F1F5F9] px-4 py-2 text-xs font-semibold text-[#0F172A] tabular-nums dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
              {grp.label} ({grp.rows.length})
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-[0.04em] text-[#334155] dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
                  <th className="px-3.5 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSort("code")}
                      className="inline-flex items-center gap-1 hover:text-[#204CD3] dark:hover:text-slate-100"
                    >
                      App ID <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-3.5 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSort("company")}
                      className="inline-flex items-center gap-1 hover:text-[#204CD3] dark:hover:text-slate-100"
                    >
                      Company <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-3.5 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSort("position")}
                      className="inline-flex items-center gap-1 hover:text-[#204CD3] dark:hover:text-slate-100"
                    >
                      Position <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-3.5 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSort("stage")}
                      className="inline-flex items-center gap-1 hover:text-[#204CD3] dark:hover:text-slate-100"
                    >
                      Stage <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-3.5 py-2.5">Outcome</th>
                  <th className="px-3.5 py-2.5">Platform & Method</th>
                  <th className="px-3.5 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSort("submittedOn")}
                      className="inline-flex items-center gap-1 hover:text-[#204CD3] dark:hover:text-slate-100"
                    >
                      Applied On <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-3.5 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleSort("expectedSalary")}
                      className="inline-flex items-center gap-1 hover:text-[#204CD3] dark:hover:text-slate-100"
                    >
                      Expected Salary <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-3.5 py-2.5">CV Used</th>
                  <th className="px-3.5 py-2.5">Next Follow-up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] dark:divide-slate-800">
                {grp.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-10 text-center text-[#64748B]"
                    >
                      No applications match the active filters.
                    </td>
                  </tr>
                ) : (
                  grp.rows.map((app) => (
                    <tr
                      key={app.id}
                      className="transition-colors hover:bg-[#EEF2FF]/50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-3.5 py-2.5 font-mono text-xs font-semibold tabular-nums">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/applications/${app.id}`}
                            className="text-[#204CD3] hover:underline dark:text-[#B7C4FF]"
                          >
                            {app.code}
                          </Link>
                          {app.isSample && <SampleBadge />}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold text-[#0F172A] dark:text-slate-100">
                        {app.company.name}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <Link
                          href={`/applications/${app.id}`}
                          className="font-semibold text-[#0F172A] hover:text-[#204CD3] dark:text-slate-100"
                        >
                          {app.vacancy.title}
                        </Link>
                        {app.jobCategory && (
                          <span className="block text-[11px] text-[#64748B]">
                            {app.jobCategory}
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <StageBadge
                          name={app.stage.name}
                          color={app.stage.color}
                        />
                      </td>
                      <td className="px-3.5 py-2.5">
                        <OutcomeBadge outcome={app.outcome} />
                      </td>
                      <td className="px-3.5 py-2.5 text-[#334155] dark:text-slate-300">
                        <div className="font-medium">
                          {app.platform?.name ?? "Direct"}
                        </div>
                        <div className="text-[11px] text-[#64748B]">
                          {
                            SUBMISSION_METHOD_LABELS[
                              app.submissionMethod as SubmissionMethod
                            ]
                          }
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-xs text-[#334155] tabular-nums dark:text-slate-300">
                        {formatDate(app.submittedOn)}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-xs font-semibold text-[#0F172A] tabular-nums dark:text-slate-300">
                        {formatMoney(app.expectedSalary, app.currency, true)}
                      </td>
                      <td className="px-3.5 py-2.5 text-xs text-[#64748B]">
                        {app.cvVersionLabel ?? "Not set"}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-xs text-[#64748B] tabular-nums">
                        {app.nextFollowUpOn
                          ? formatDate(app.nextFollowUpOn)
                          : "None"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
