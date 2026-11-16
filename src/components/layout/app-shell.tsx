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

function getUserInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U"
  );
}

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
    <div className="elevation-0 flex min-h-screen bg-[#f4fbf4] text-[#171d19] dark:bg-[#0b120e] dark:text-[#ecf3eb]">
      <AppSidebar
        user={user}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 bg-[#f4fbf4]/85 px-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl md:px-8 dark:bg-[#0b120e]/85">
          <div className="flex flex-1 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-xl p-2 text-[#3e4a41] transition-colors hover:bg-[#eff5ee] hover:text-[#006a42] md:hidden dark:text-[#b7c6ba]"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="flex h-10 w-full max-w-md items-center justify-between gap-2 rounded-xl bg-[#eff5ee] px-3.5 text-xs text-[#3f674f] transition-all hover:bg-[#ffffff] hover:shadow-sm dark:bg-[#17231c] dark:text-[#a5d1b4] dark:hover:bg-[#1d2b23]"
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="h-4 w-4 shrink-0 text-[#3f674f] dark:text-[#a5d1b4]" />
                <span className="hidden truncate sm:inline">
                  Search jobs, applications, companies, or tags...
                </span>
                <span className="truncate sm:hidden">Search...</span>
              </span>
              <kbd className="hidden rounded-lg bg-[#ffffff] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#3e4a41] shadow-2xs sm:inline dark:bg-[#23342a] dark:text-[#ecf3eb]">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="relative flex items-center gap-2.5">
            <Link
              href="/jobs/new"
              className="btn-secondary hidden h-10 px-4 text-xs sm:inline-flex"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Job</span>
            </Link>
            <Link
              href="/applications?new=1"
              className="btn-primary h-10 px-4 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Log Application</span>
            </Link>

            <button
              type="button"
              onClick={() => setNotifOpen(!notifOpen)}
              aria-label="Open notifications"
              className="btn-ghost relative h-10 w-10 p-0"
            >
              <Bell className="h-[19px] w-[19px]" />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ba1a1a] px-1 font-mono text-[10px] font-bold text-white ring-2 ring-[#f4fbf4] tabular-nums dark:ring-[#0b120e]">
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
              className="btn-ghost h-10 w-10 p-0"
            >
              <Sun className="hidden h-[18px] w-[18px] dark:block" />
              <Moon className="block h-[18px] w-[18px] dark:hidden" />
            </button>

            <div className="hidden h-6 w-px bg-[#dde4dd] lg:block dark:bg-[#24332a]" />

            <Link
              href="/settings"
              className="hidden items-center gap-2.5 rounded-xl px-2 py-1 transition-colors hover:bg-[#eff5ee] lg:flex dark:hover:bg-[#17231c]"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#c0edcf] text-xs font-bold text-[#005232] dark:bg-[#274f39] dark:text-[#c0edcf]">
                {getUserInitials(user.name)}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[13px] font-semibold leading-tight text-[#171d19] dark:text-[#ecf3eb]">
                  {user.name}
                </span>
                <span className="text-[11px] leading-tight text-[#3f674f] dark:text-[#a5d1b4]">
                  Executive ATS
                </span>
              </div>
            </Link>

            {notifOpen && (
              <div className="elevation-4 absolute top-12 right-0 z-50 w-80 rounded-2xl border border-[#bdcabf]/60 bg-[#ffffff] p-4 sm:w-96 dark:border-[#24332a] dark:bg-[#111a15]">
                <div className="mb-3 flex items-center justify-between border-b border-[#e3eae3] pb-2.5 dark:border-[#24332a]">
                  <span className="text-[13px] font-semibold text-[#171d19] dark:text-[#ecf3eb]">
                    Recruitment Reminders & Notifications ({notifications.length}
                    )
                  </span>
                  <button
                    type="button"
                    onClick={() => setNotifOpen(false)}
                    className="rounded-lg p-1 text-[#3e4a41] hover:bg-[#eff5ee] hover:text-[#006a42] dark:text-[#b7c6ba]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {notifications.length === 0 ? (
                  <p className="py-6 text-center text-xs text-[#3f674f] dark:text-[#a5d1b4]">
                    No active reminders or pending email confirmations.
                  </p>
                ) : (
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-start justify-between gap-2 rounded-xl bg-[#eff5ee] p-3 text-xs dark:bg-[#17231c]"
                      >
                        <Link
                          href={n.href}
                          onClick={() => setNotifOpen(false)}
                          className="min-w-0 flex-1"
                        >
                          <p
                            className={`font-semibold ${
                              n.severity === "urgent"
                                ? "text-[#93000a] dark:text-rose-400"
                                : n.severity === "warning"
                                  ? "text-[#5d4211] dark:text-amber-300"
                                  : "text-[#006a42] dark:text-[#69dca0]"
                            }`}
                          >
                            {n.title}
                          </p>
                          <p className="mt-0.5 truncate text-[#3e4a41] dark:text-[#b7c6ba]">
                            {n.body}
                          </p>
                        </Link>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleDismiss(n.id)}
                          title="Dismiss notification"
                          className="rounded-lg p-1 text-[#3e4a41] hover:bg-[#ffffff] hover:text-[#006a42] dark:text-[#b7c6ba]"
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

        <main className="relative flex-1 p-4 md:p-8">
          <div className="pointer-events-none absolute top-0 right-1/4 -z-10 h-32 w-96 rounded-full bg-[#86f9ba]/20 blur-3xl dark:bg-[#006a42]/10" />
          <div className="pointer-events-none absolute top-4 left-1/3 -z-10 h-24 w-64 rounded-full bg-[#ffdead]/20 blur-2xl dark:bg-[#745725]/10" />
          {children}
        </main>
      </div>

      <CommandMenu open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}
