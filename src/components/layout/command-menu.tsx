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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-[#171d19]/35 p-4 pt-20 backdrop-blur-[3px]">
      <div className="elevation-4 w-full max-w-lg overflow-hidden rounded-2xl border border-[#bdcabf]/60 bg-[#ffffff] dark:border-[#24332a] dark:bg-[#111a15]">
        <div className="flex items-center gap-2.5 border-b border-[#e3eae3] px-4 py-3 dark:border-[#24332a]">
          <Search className="h-4 w-4 text-[#3f674f] dark:text-[#a5d1b4]" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search job vacancies, applications, companies, codes (JOB-0001, APP-0001)..."
            className="w-full border-none bg-transparent text-sm text-[#171d19] shadow-none outline-none placeholder:text-[#6e7a71] focus:ring-0 dark:text-[#ecf3eb]"
          />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1 text-[#3e4a41] hover:bg-[#eff5ee] hover:text-[#006a42] dark:text-[#b7c6ba] dark:hover:bg-[#17231c]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2.5 text-xs">
          {!query.trim() ? (
            <div className="space-y-1 p-1.5">
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#3f674f] dark:text-[#a5d1b4]">
                Quick Navigation
              </p>
              <button
                type="button"
                onClick={() => goTo("/jobs/new")}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-[#171d19] hover:bg-[#eff5ee] hover:text-[#006a42] dark:text-[#ecf3eb] dark:hover:bg-[#17231c]"
              >
                <Briefcase className="h-4 w-4 text-[#006a42] dark:text-[#69dca0]" />
                Add new job vacancy
              </button>
              <button
                type="button"
                onClick={() => goTo("/applications?view=board")}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-[#171d19] hover:bg-[#eff5ee] hover:text-[#006a42] dark:text-[#ecf3eb] dark:hover:bg-[#17231c]"
              >
                <Kanban className="h-4 w-4 text-[#006a42] dark:text-[#69dca0]" />
                Open recruitment Kanban board
              </button>
            </div>
          ) : isPending ? (
            <p className="p-4 text-center text-[#3f674f]">Searching...</p>
          ) : results.applications.length === 0 && results.vacancies.length === 0 ? (
            <p className="p-4 text-center text-[#3f674f]">
              No matching applications or vacancies found.
            </p>
          ) : (
            <div className="space-y-3">
              {results.applications.length > 0 && (
                <div>
                  <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#3f674f]">
                    Applications
                  </p>
                  {results.applications.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => goTo(`/applications/${a.id}`)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-[#eff5ee] dark:hover:bg-[#17231c]"
                    >
                      <span>
                        <span className="font-mono font-semibold text-[#006a42] tabular-nums dark:text-[#69dca0]">
                          {a.code}
                        </span>{" "}
                        <span className="font-semibold text-[#171d19] dark:text-[#ecf3eb]">
                          {a.title}
                        </span>{" "}
                        <span className="text-[#3f674f]">at {a.companyName}</span>
                      </span>
                      <span className="rounded-full bg-[#c0edcf] px-2.5 py-0.5 text-[11px] font-semibold text-[#005232]">
                        {a.stageName}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {results.vacancies.length > 0 && (
                <div>
                  <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#3f674f]">
                    Job Vacancies
                  </p>
                  {results.vacancies.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => goTo(`/jobs/${v.id}`)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-[#eff5ee] dark:hover:bg-[#17231c]"
                    >
                      <span>
                        <span className="font-mono text-[#3f674f] tabular-nums">
                          {v.code}
                        </span>{" "}
                        <span className="font-semibold text-[#171d19] dark:text-[#ecf3eb]">
                          {v.title}
                        </span>{" "}
                        <span className="text-[#3f674f]">at {v.companyName}</span>
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
