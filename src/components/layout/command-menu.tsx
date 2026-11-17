"use client";

import {
  Archive,
  Briefcase,
  Coins,
  Kanban,
  RefreshCw,
  Search,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui";
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
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open || !query.trim()) {
      return;
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await globalSearchAction(query);
        setResults(res);
      });
    }, 150);
    return () => clearTimeout(timer);
  }, [query, open]);

  function goTo(href: string) {
    onOpenChange(false);
    setQuery("");
    setResults({ vacancies: [], applications: [] });
    router.push(href);
  }

  function handleQueryChange(next: string) {
    setQuery(next);
    if (!next.trim()) {
      setResults({ vacancies: [], applications: [] });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[18%] max-w-lg translate-y-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">Global Command Search</DialogTitle>
        <DialogDescription className="sr-only">
          Search across job vacancies, applications, companies, and tracking codes.
        </DialogDescription>

        <div className="flex items-center gap-2.5 border-b border-border-subtle px-4 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-primary-text" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            aria-label="Search vacancies and applications"
            placeholder="Search job vacancies, applications, companies, codes (JOB-0001, APP-0001)..."
            className="h-8 min-w-0 flex-1 border-none bg-transparent text-sm text-foreground shadow-none outline-none placeholder:text-subtle-foreground focus-visible:shadow-none focus-visible:ring-0"
          />
          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </div>

        <div className="max-h-80 overflow-y-auto p-2.5 text-xs">
          {!query.trim() ? (
            <div className="space-y-1 p-1.5">
              <p className="px-2 py-1 text-label-xs uppercase text-muted-foreground">
                Quick Navigation
              </p>
              <button
                type="button"
                onClick={() => goTo("/jobs/new")}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-surface-subtle hover:text-primary-text"
              >
                <Briefcase className="h-4 w-4 text-primary-text" />
                Add new job vacancy
              </button>
              <button
                type="button"
                onClick={() => goTo("/applications?view=board")}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-surface-subtle hover:text-primary-text"
              >
                <Kanban className="h-4 w-4 text-primary-text" />
                Open recruitment Kanban board
              </button>
              <button
                type="button"
                onClick={() => goTo("/profile")}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-surface-subtle hover:text-primary-text"
              >
                <UserCheck className="h-4 w-4 text-primary-text" />
                Edit Master Career Profile
              </button>
              <button
                type="button"
                onClick={() => goTo("/archive")}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-surface-subtle hover:text-primary-text"
              >
                <Archive className="h-4 w-4 text-primary-text" />
                Open application archive
              </button>
              <button
                type="button"
                onClick={() => goTo("/cv-studio")}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-surface-subtle hover:text-primary-text"
              >
                <Sparkles className="h-4 w-4 text-primary-text" />
                Open AI CV Studio
              </button>
              <button
                type="button"
                onClick={() => goTo("/credits")}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-surface-subtle hover:text-primary-text"
              >
                <Coins className="h-4 w-4 text-primary-text" />
                Open credit wallet
              </button>
              <button
                type="button"
                onClick={() => goTo("/sync")}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface-subtle"
              >
                <RefreshCw className="h-4 w-4 text-primary-text" />
                Open hybrid sync center
              </button>
            </div>
          ) : isPending ? (
            <p className="p-4 text-center text-muted-foreground">Searching...</p>
          ) : results.applications.length === 0 &&
            results.vacancies.length === 0 ? (
            <p className="p-4 text-center text-muted-foreground">
              No matching applications or vacancies found.
            </p>
          ) : (
            <div className="space-y-3">
              {results.applications.length > 0 && (
                <div>
                  <p className="px-2 py-1 text-label-xs uppercase text-muted-foreground">
                    Applications
                  </p>
                  {results.applications.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => goTo(`/applications/${a.id}`)}
                      className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface-subtle"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-mono font-semibold text-primary-text tabular-nums">
                          {a.code}
                        </span>{" "}
                        <span className="font-semibold text-foreground">
                          {a.title}
                        </span>{" "}
                        <span className="text-muted-foreground">
                          at {a.companyName}
                        </span>
                      </span>
                      <Badge variant="primary" className="shrink-0">
                        {a.stageName}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
              {results.vacancies.length > 0 && (
                <div>
                  <p className="px-2 py-1 text-label-xs uppercase text-muted-foreground">
                    Job Vacancies
                  </p>
                  {results.vacancies.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => goTo(`/jobs/${v.id}`)}
                      className="flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface-subtle"
                    >
                      <span className="truncate">
                        <span className="font-mono text-muted-foreground tabular-nums">
                          {v.code}
                        </span>{" "}
                        <span className="font-semibold text-foreground">
                          {v.title}
                        </span>{" "}
                        <span className="text-muted-foreground">
                          at {v.companyName}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
