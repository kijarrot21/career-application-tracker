"use client";

import { Bell, Menu, Moon, Plus, Search, Sun, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Button,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";
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
      try {
        await dismissNotificationAction(id);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not dismiss notification",
        );
      }
    });
  }

  return (
    <div className="elevation-0 flex min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-xs focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      <AppSidebar
        user={user}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border-subtle bg-background/85 px-4 backdrop-blur-xl md:px-8">
          <div className="flex flex-1 items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="md:hidden"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              aria-label="Open global search"
              className="flex h-10 w-full max-w-md cursor-pointer items-center justify-between gap-2 rounded-xl border border-transparent bg-surface-subtle px-3.5 text-xs text-muted-foreground transition-all hover:border-border hover:bg-card hover:text-foreground hover:shadow-xs"
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="h-4 w-4 shrink-0 text-primary-text" />
                <span className="hidden truncate sm:inline">
                  Search jobs, applications, companies, or tags...
                </span>
                <span className="truncate sm:hidden">Search...</span>
              </span>
              <kbd className="hidden rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground sm:inline">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="lg"
              asChild
              className="hidden sm:inline-flex"
            >
              <Link href="/jobs/new">
                <Plus className="h-3.5 w-3.5" />
                <span>Add Job</span>
              </Link>
            </Button>
            <Button variant="primary" size="lg" asChild>
              <Link href="/applications?new=1">
                <Plus className="h-3.5 w-3.5" />
                <span>Log Application</span>
              </Link>
            </Button>

            <Popover open={notifOpen} onOpenChange={setNotifOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open notifications"
                  className="relative"
                >
                  <Bell className="h-[18px] w-[18px]" />
                  {notifications.length > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 font-mono text-[10px] font-bold text-destructive-foreground ring-2 ring-background tabular-nums">
                      {notifications.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 sm:w-96">
                <div className="mb-3 flex items-center justify-between border-b border-border-subtle pb-2.5">
                  <span className="text-[13px] font-semibold text-foreground">
                    Reminders & Notifications ({notifications.length})
                  </span>
                  <PopoverClose asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Close notifications"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverClose>
                </div>

                {notifications.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    No active reminders or pending email confirmations.
                  </p>
                ) : (
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className="flex items-start justify-between gap-2 rounded-xl bg-surface-subtle p-3 text-xs"
                      >
                        <Link
                          href={n.href}
                          onClick={() => setNotifOpen(false)}
                          className="min-w-0 flex-1"
                        >
                          <p
                            className={cn(
                              "font-semibold",
                              n.severity === "urgent"
                                ? "text-destructive-on-soft"
                                : n.severity === "warning"
                                  ? "text-warning-on-soft"
                                  : "text-primary-text",
                            )}
                          >
                            {n.title}
                          </p>
                          <p className="mt-0.5 truncate text-muted-foreground">
                            {n.body}
                          </p>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={isPending}
                          onClick={() => handleDismiss(n.id)}
                          aria-label={`Dismiss ${n.title}`}
                          title="Dismiss notification"
                          className="h-6 w-6"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
              aria-label="Toggle color theme"
            >
              <Sun className="hidden h-[18px] w-[18px] dark:block" />
              <Moon className="block h-[18px] w-[18px] dark:hidden" />
            </Button>

            <div className="hidden h-6 w-px bg-border lg:block" />

            <Link
              href="/settings"
              className="hidden items-center gap-2.5 rounded-xl px-2 py-1 transition-colors hover:bg-surface-subtle lg:flex"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-on-soft">
                {getUserInitials(user.name)}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[13px] font-semibold leading-tight text-foreground">
                  {user.name}
                </span>
                <span className="text-[11px] leading-tight text-muted-foreground">
                  Executive ATS
                </span>
              </div>
            </Link>
          </div>
        </header>

        {banner}

        <main id="main-content" className="relative flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>

      <CommandMenu open={cmdOpen} onOpenChange={setCmdOpen} />
    </div>
  );
}
