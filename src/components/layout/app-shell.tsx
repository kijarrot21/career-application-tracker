"use client";

import { Bell, Menu, Moon, Plus, Search, Sun, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useTransition } from "react";
import { dismissNotificationAction } from "@/server/actions/emails";
import type { LiveNotificationItem } from "@/server/queries/emails";
import { AppSidebar } from "./app-sidebar";
import { CommandMenu } from "./command-menu";

export function AppShell({
  user,
  notifications = [],
  banner,
  children,
}: {
  user: { name: string; email: string };
  notifications?: LiveNotificationItem[];
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  function handleDismiss(id: string) {
    startTransition(async () => {
      await dismissNotificationAction(id);
      router.refresh();
    });
  }

  return (
    <div className="elevation-0 flex min-h-screen bg-[#F8FAFC] text-[#0F172A] dark:bg-[#0B1120] dark:text-[#F8FAFC]">
      <AppSidebar
        user={user}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-[#E2E8F0] bg-[#FFFFFF]/95 px-4 backdrop-blur md:px-8 dark:border-slate-800 dark:bg-slate-950/95">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-[4px] p-1.5 text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#204CD3] md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="flex h-9 items-center gap-2 rounded-[4px] border border-[#CBD5E1] bg-[#F1F5F9] px-3 text-xs text-[#64748B] transition-colors hover:border-[#204CD3] hover:text-[#0F172A] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
            >
              <Search className="h-3.5 w-3.5 text-[#94A3B8]" />
              <span className="hidden sm:inline">
                Search jobs, applications...
              </span>
              <span className="sm:hidden">Search...</span>
              <kbd className="hidden rounded-[4px] border border-[#E2E8F0] bg-[#FFFFFF] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#64748B] sm:inline dark:border-slate-700 dark:bg-slate-800">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="relative flex items-center gap-2">
            <Link
              href="/jobs/new"
              className="btn-secondary h-9 px-3 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Job</span>
            </Link>
            <Link
              href="/applications?new=1"
              className="btn-primary h-9 px-3 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Log Application</span>
            </Link>

            <button
              type="button"
              onClick={() => setNotifOpen(!notifOpen)}
              aria-label="Open notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#204CD3] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <Bell className="h-4 w-4" />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F43F5E] px-1 font-mono text-[10px] font-bold text-white tabular-nums">
                  {notifications.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
              aria-label="Toggle color theme"
              className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-[#CBD5E1] bg-[#FFFFFF] text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#204CD3] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <Sun className="hidden h-4 w-4 dark:block" />
              <Moon className="block h-4 w-4 dark:hidden" />
            </button>

            {notifOpen && (
              <div className="elevation-4 absolute top-11 right-0 z-50 w-80 rounded-[8px] border border-[#E2E8F0] bg-[#FFFFFF] p-3.5 sm:w-96 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-2.5 flex items-center justify-between border-b border-[#E2E8F0] pb-2 dark:border-slate-800">
                  <span className="text-label-md text-[#0F172A] dark:text-slate-100">
                    Recruitment Reminders & Notifications ({notifications.length}
                    )
                  </span>
                  <button
                    type="button"
                    onClick={() => setNotifOpen(false)}
                    className="rounded-[4px] p-1 text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#204CD3]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {notifications.length === 0 ? (
                  <p className="py-6 text-center text-xs text-[#64748B]">
                    No active reminders or pending email confirmations.
                  </p>
                ) : (
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-start justify-between gap-2 rounded-[8px] border border-[#E2E8F0] bg-[#F8FAFC] p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950"
                      >
                        <Link
                          href={n.href}
                          onClick={() => setNotifOpen(false)}
                          className="min-w-0 flex-1"
                        >
                          <p
                            className={`font-semibold ${
                              n.severity === "urgent"
                                ? "text-[#BE123C] dark:text-rose-400"
                                : n.severity === "warning"
                                  ? "text-[#B45309] dark:text-amber-300"
                                  : "text-[#1D4ED8] dark:text-indigo-400"
                            }`}
                          >
                            {n.title}
                          </p>
                          <p className="mt-0.5 truncate text-[#334155] dark:text-slate-300">
                            {n.body}
                          </p>
                        </Link>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleDismiss(n.id)}
                          title="Dismiss notification"
                          className="rounded-[4px] p-1 text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#204CD3]"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {banner}

        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>

      <CommandMenu open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}
