"use client";

import {
  BarChart3,
  BookmarkCheck,
  Briefcase,
  CalendarClock,
  FileText,
  Kanban,
  LayoutDashboard,
  LogOut,
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  phaseBadge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Find Jobs", href: "/jobs", icon: Briefcase },
  { label: "Job Shortlist", href: "/shortlist", icon: BookmarkCheck },
  { label: "Applications", href: "/applications", icon: Kanban },
  { label: "Interviews", href: "/interviews", icon: CalendarClock },
  { label: "Email Center", href: "/emails", icon: Mail },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar({
  user,
  mobileOpen,
  onCloseMobile,
}: {
  user: { name: string; email: string };
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsedOverride, setCollapsedOverride] = useState<boolean | null>(
    null,
  );

  async function handleSignOut() {
    await signOut();
    router.push("/sign-in");
    router.refresh();
  }

  function renderSidebarContent(isMobileDrawer: boolean) {
    // On mobile drawer, always expanded.
    // Otherwise: if user toggled collapsedOverride, use it; else collapsed on tablet (md..xl) and expanded on xl+.
    const isCollapsed = !isMobileDrawer && collapsedOverride === true;
    const isAutoResponsive = !isMobileDrawer && collapsedOverride === null;

    const labelVisibilityClass = isMobileDrawer
      ? "inline"
      : isCollapsed
        ? "hidden"
        : isAutoResponsive
          ? "hidden xl:inline"
          : "inline";

    const badgeVisibilityClass = isMobileDrawer
      ? "inline-flex"
      : isCollapsed
        ? "hidden"
        : isAutoResponsive
          ? "hidden xl:inline-flex"
          : "inline-flex";

    return (
      <div className="flex h-full flex-col justify-between border-r border-[#E2E8F0] bg-[#FFFFFF] dark:border-slate-800 dark:bg-slate-950">
        <div>
          <div className="flex h-14 items-center justify-between border-b border-[#E2E8F0] px-3.5 dark:border-slate-800">
            <Link
              href="/dashboard"
              onClick={onCloseMobile}
              title="Career Tracker | Executive Precision"
              className="flex items-center gap-2.5 font-display font-semibold tracking-[-0.015em] text-[#0F172A] dark:text-slate-100"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] bg-[#204CD3] text-xs font-bold text-white shadow-2xs">
                CT
              </span>
              <span className={cn("text-[15px] truncate", labelVisibilityClass)}>
                Career Tracker
              </span>
            </Link>

            {isMobileDrawer && onCloseMobile ? (
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close navigation menu"
                className="rounded-[4px] p-1.5 text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#204CD3] md:hidden"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  setCollapsedOverride((prev) =>
                    prev === null ? true : !prev,
                  )
                }
                aria-label={
                  isCollapsed ? "Expand sidebar" : "Collapse sidebar"
                }
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className={cn(
                  "rounded-[4px] p-1 text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#204CD3]",
                  isCollapsed
                    ? "hidden"
                    : isAutoResponsive
                      ? "hidden xl:inline-flex"
                      : "inline-flex",
                )}
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}
          </div>

          {!isMobileDrawer && isCollapsed && (
            <div className="flex justify-center border-b border-[#E2E8F0] py-2 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCollapsedOverride(false)}
                aria-label="Expand sidebar"
                title="Expand sidebar"
                className="rounded-[4px] p-1.5 text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#204CD3]"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            </div>
          )}

          <nav className="space-y-1 p-2.5" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              if (!item.href) {
                return (
                  <div
                    key={item.label}
                    aria-disabled="true"
                    title={`${item.label} unlocks in ${item.phaseBadge}`}
                    className="flex cursor-not-allowed items-center justify-between rounded-[4px] px-2.5 py-2 text-[13px] leading-[18px] font-medium text-[#64748B]/60 select-none dark:text-slate-600"
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className={labelVisibilityClass}>{item.label}</span>
                    </span>
                    <span
                      className={cn(
                        "rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-[1px] font-mono text-[10px] font-semibold tracking-[0.04em] text-[#64748B] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500",
                        badgeVisibilityClass,
                      )}
                    >
                      {item.phaseBadge}
                    </span>
                  </div>
                );
              }

              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={onCloseMobile}
                  title={item.label}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[4px] px-2.5 py-2 text-[13px] leading-[18px] font-semibold transition-colors",
                    active
                      ? "bg-[#EEF2FF] text-[#1D4ED8] dark:bg-[#204CD3]/20 dark:text-[#B7C4FF]"
                      : "text-[#334155] hover:bg-[#EEF2FF] hover:text-[#204CD3] dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      active ? "text-[#204CD3] dark:text-[#B7C4FF]" : "text-[#64748B]",
                    )}
                  />
                  <span className={cn("truncate", labelVisibilityClass)}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-[#E2E8F0] p-2.5 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2 rounded-[4px] border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-2 dark:border-slate-800 dark:bg-slate-900">
            <div className={cn("min-w-0", labelVisibilityClass)}>
              <p className="truncate text-[13px] font-semibold text-[#0F172A] dark:text-slate-100">
                {user.name}
              </p>
              <p className="truncate text-[11px] text-[#64748B] dark:text-slate-400">
                {user.email}
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              title="Sign out"
              aria-label="Sign out"
              className="rounded-[4px] p-1.5 text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#204CD3] dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Responsive sidebar width: 64px (w-16) on tablet (768px-1279px) or when collapsed, 240px (w-60) on desktop (1280px+)
  const desktopAsideWidth =
    collapsedOverride === true
      ? "md:w-16"
      : collapsedOverride === false
        ? "md:w-60"
        : "md:w-16 xl:w-60";

  return (
    <>
      <aside className={cn("hidden shrink-0 md:block transition-[width] duration-200", desktopAsideWidth)}>
        {renderSidebarContent(false)}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-[#0B1C30]/20 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="elevation-4 relative z-10 w-60 max-w-[80vw]">
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}
    </>
  );
}
