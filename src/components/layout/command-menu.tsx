"use client";

import { Briefcase, Kanban, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { globalSearchAction } from "@/server/actions/settings";

export function CommandMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<{
    vacancies: { id: string; code: string; title: string; companyName: string }[];
    applications: {
      id: string;
      code: string;
      title: string;
      companyName: string;
      stageName: string;
    }[];
  }>({ vacancies: [], applications: [] });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      } else if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open || !query.trim()) return;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await globalSearchAction(query);
        setResults(res);
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [query, open]);

  if (!open) return null;

  function goTo(href: string) {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-[#0B1C30]/20 p-4 pt-20 backdrop-blur-[1px]">
      <div className="elevation-4 w-full max-w-lg overflow-hidden rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-2.5 border-b border-[#E2E8F0] px-3.5 py-2.5 dark:border-slate-800">
          <Search className="h-4 w-4 text-[#94A3B8]" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search job vacancies, applications, companies, codes (JOB-0001, APP-0001)..."
            className="w-full border-none bg-transparent text-sm text-[#0F172A] shadow-none outline-none placeholder:text-[#64748B] focus:ring-0 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-[4px] p-1 text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#204CD3] dark:hover:bg-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 text-xs">
          {!query.trim() ? (
            <div className="space-y-1 p-2">
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748B]">
                Quick Navigation
              </p>
              <button
                type="button"
                onClick={() => goTo("/jobs/new")}
                className="flex w-full items-center gap-2.5 rounded-[4px] px-2.5 py-2 text-left text-[13px] font-medium text-[#334155] hover:bg-[#EEF2FF] hover:text-[#1D4ED8] dark:text-slate-300 dark:hover:bg-slate-900"
              >
                <Briefcase className="h-4 w-4 text-[#204CD3]" />
                Add new job vacancy
              </button>
              <button
                type="button"
                onClick={() => goTo("/applications?view=board")}
                className="flex w-full items-center gap-2.5 rounded-[4px] px-2.5 py-2 text-left text-[13px] font-medium text-[#334155] hover:bg-[#EEF2FF] hover:text-[#1D4ED8] dark:text-slate-300 dark:hover:bg-slate-900"
              >
                <Kanban className="h-4 w-4 text-[#204CD3]" />
                Open recruitment Kanban board
              </button>
            </div>
          ) : isPending ? (
            <p className="p-4 text-center text-[#64748B]">Searching...</p>
          ) : results.applications.length === 0 && results.vacancies.length === 0 ? (
            <p className="p-4 text-center text-[#64748B]">
              No matching applications or vacancies found.
            </p>
          ) : (
            <div className="space-y-3">
              {results.applications.length > 0 && (
                <div>
                  <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748B]">
                    Applications
                  </p>
                  {results.applications.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => goTo(`/applications/${a.id}`)}
                      className="flex w-full items-center justify-between rounded-[4px] px-2.5 py-2 text-left hover:bg-[#EEF2FF] dark:hover:bg-slate-900"
                    >
                      <span>
                        <span className="font-mono font-semibold text-[#204CD3] tabular-nums dark:text-[#B7C4FF]">
                          {a.code}
                        </span>{" "}
                        <span className="font-semibold text-[#0F172A] dark:text-slate-100">
                          {a.title}
                        </span>{" "}
                        <span className="text-[#64748B]">at {a.companyName}</span>
                      </span>
                      <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-semibold text-[#1D4ED8]">
                        {a.stageName}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {results.vacancies.length > 0 && (
                <div>
                  <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#64748B]">
                    Job Vacancies
                  </p>
                  {results.vacancies.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => goTo(`/jobs/${v.id}`)}
                      className="flex w-full items-center justify-between rounded-[4px] px-2.5 py-2 text-left hover:bg-[#EEF2FF] dark:hover:bg-slate-900"
                    >
                      <span>
                        <span className="font-mono text-[#64748B] tabular-nums">
                          {v.code}
                        </span>{" "}
                        <span className="font-semibold text-[#0F172A] dark:text-slate-100">
                          {v.title}
                        </span>{" "}
                        <span className="text-[#64748B]">at {v.companyName}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
