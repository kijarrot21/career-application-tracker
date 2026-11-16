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
          <label className="font-semibold text-[#3f674f] dark:text-[#a5d1b4]">
            Group rows by:
          </label>
          <select
            aria-label="Group applications by"
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="h-9 rounded-xl border border-[#bdcabf]/60 bg-[#ffffff] px-3 text-xs font-medium text-[#171d19] dark:border-[#2d3d33] dark:bg-[#111a15] dark:text-[#ecf3eb]"
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
          className="btn-secondary h-10 px-4 text-xs tabular-nums"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV ({applications.length})
        </a>
      </div>

      {groups.map((grp) => (
        <div
          key={grp.key}
          className="elevation-1 overflow-hidden rounded-2xl border border-[#bdcabf]/40 bg-[#ffffff] p-4 dark:border-[#24332a] dark:bg-[#111a15]"
        >
          {groupBy !== "none" && (
            <div className="mb-3 rounded-xl bg-[#eff5ee] px-4 py-2 text-xs font-semibold text-[#171d19] tabular-nums dark:bg-[#17231c] dark:text-[#ecf3eb]">
              {grp.label} ({grp.rows.length})
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="rounded-xl bg-[#eff5ee]/80 text-[11px] font-semibold uppercase tracking-wider text-[#3f674f] dark:bg-[#17231c] dark:text-[#a5d1b4]">
                  <th className="rounded-l-xl px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("code")}
                      className="inline-flex items-center gap-1 hover:text-[#006a42] dark:hover:text-[#69dca0]"
                    >
                      App ID <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("company")}
                      className="inline-flex items-center gap-1 hover:text-[#006a42] dark:hover:text-[#69dca0]"
                    >
                      Company <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("position")}
                      className="inline-flex items-center gap-1 hover:text-[#006a42] dark:hover:text-[#69dca0]"
                    >
                      Position <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("stage")}
                      className="inline-flex items-center gap-1 hover:text-[#006a42] dark:hover:text-[#69dca0]"
                    >
                      Stage <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3">Outcome</th>
                  <th className="px-4 py-3">Platform & Method</th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("submittedOn")}
                      className="inline-flex items-center gap-1 hover:text-[#006a42] dark:hover:text-[#69dca0]"
                    >
                      Applied On <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("expectedSalary")}
                      className="inline-flex items-center gap-1 hover:text-[#006a42] dark:hover:text-[#69dca0]"
                    >
                      Expected Salary <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3">CV Used</th>
                  <th className="rounded-r-xl px-4 py-3">Next Follow-up</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e3eae3]/70 dark:divide-[#24332a]">
                {grp.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-10 text-center text-[#3f674f] dark:text-[#a5d1b4]"
                    >
                      No applications match the active filters.
                    </td>
                  </tr>
                ) : (
                  grp.rows.map((app) => (
                    <tr
                      key={app.id}
                      className="transition-colors hover:bg-[#eff5ee]/50 dark:hover:bg-[#17231c]/60"
                    >
                      <td className="px-4 py-3.5 font-mono text-xs font-semibold tabular-nums">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/applications/${app.id}`}
                            className="text-[#006a42] hover:underline dark:text-[#69dca0]"
                          >
                            {app.code}
                          </Link>
                          {app.isSample && <SampleBadge />}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-[#171d19] dark:text-[#ecf3eb]">
                        {app.company.name}
                      </td>
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/applications/${app.id}`}
                          className="font-semibold text-[#171d19] hover:text-[#006a42] dark:text-[#ecf3eb] dark:hover:text-[#69dca0]"
                        >
                          {app.vacancy.title}
                        </Link>
                        {app.jobCategory && (
                          <span className="block text-[11px] text-[#3f674f] dark:text-[#a5d1b4]">
                            {app.jobCategory}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <StageBadge
                          name={app.stage.name}
                          color={app.stage.color}
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <OutcomeBadge outcome={app.outcome} />
                      </td>
                      <td className="px-4 py-3.5 text-[#3e4a41] dark:text-[#b7c6ba]">
                        <div className="font-medium">
                          {app.platform?.name ?? "Direct"}
                        </div>
                        <div className="text-[11px] text-[#6e7a71]">
                          {
                            SUBMISSION_METHOD_LABELS[
                              app.submissionMethod as SubmissionMethod
                            ]
                          }
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-[#3e4a41] tabular-nums dark:text-[#b7c6ba]">
                        {formatDate(app.submittedOn)}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs font-semibold text-[#171d19] tabular-nums dark:text-[#ecf3eb]">
                        {formatMoney(app.expectedSalary, app.currency, true)}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[#3f674f] dark:text-[#a5d1b4]">
                        {app.cvVersionLabel ?? "Not set"}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-[#3f674f] tabular-nums dark:text-[#a5d1b4]">
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
