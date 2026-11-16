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

const PIPELINE_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Applications", href: "/applications", icon: Kanban },
  { label: "Interviews", href: "/interviews", icon: CalendarClock },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
];

const ASSET_NAV_ITEMS: NavItem[] = [
  { label: "Find Jobs", href: "/jobs", icon: Briefcase },
  { label: "Job Shortlist", href: "/shortlist", icon: BookmarkCheck },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Email Center", href: "/emails", icon: Mail },
];

const FOOTER_NAV_ITEMS: NavItem[] = [
  { label: "Settings", href: "/settings", icon: Settings },
];

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

  function renderNavGroup(
    items: NavItem[],
    labelVisibilityClass: string,
    badgeVisibilityClass: string,
  ) {
    return items.map((item) => {
      const Icon = item.icon;
      if (!item.href) {
        return (
          <div
            key={item.label}
            aria-disabled="true"
            title={`${item.label} unlocks in ${item.phaseBadge}`}
            className="flex cursor-not-allowed items-center justify-between rounded-xl px-3 py-2.5 text-[14px] font-medium text-[#6e7a71]/60 select-none dark:text-slate-600"
          >
            <span className="flex items-center gap-3">
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className={labelVisibilityClass}>{item.label}</span>
            </span>
            <span
              className={cn(
                "rounded-full border border-[#bdcabf]/60 bg-[#eff5ee] px-2 py-[1px] font-mono text-[10px] font-semibold tracking-[0.04em] text-[#3e4a41]",
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
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] leading-5 transition-all",
            active
              ? "bg-[#006a42] font-semibold text-white shadow-sm dark:bg-[#008655] dark:text-[#f6fff6]"
              : "font-medium text-[#3e4a41] hover:bg-[#eff5ee] hover:text-[#171d19] dark:text-[#b7c6ba] dark:hover:bg-[#17231c] dark:hover:text-[#ecf3eb]",
          )}
        >
          <Icon
            className={cn(
              "h-[18px] w-[18px] shrink-0",
              active
                ? "text-white"
                : "text-[#3f674f] dark:text-[#a5d1b4]",
            )}
          />
          <span className={cn("truncate", labelVisibilityClass)}>
            {item.label}
          </span>
        </Link>
      );
    });
  }

  function renderSidebarContent(isMobileDrawer: boolean) {
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
      <div className="flex h-full flex-col justify-between bg-[#ffffff] shadow-[0_1px_8px_rgba(0,0,0,0.04)] dark:border-r dark:border-[#24332a] dark:bg-[#111a15]">
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Brand Header */}
          <div className="flex h-16 shrink-0 items-center justify-between px-4">
            <Link
              href="/dashboard"
              onClick={onCloseMobile}
              title="Trackr ATS | Executive Precision"
              className="flex items-center gap-2 font-display font-bold tracking-tight text-[#171d19] dark:text-[#ecf3eb]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#006a42] text-xs font-bold text-white shadow-sm">
                CT
              </span>
              <span className={cn("text-[16px] truncate", labelVisibilityClass)}>
                Trackr
              </span>
              <span
                className={cn(
                  "rounded-full bg-[#c0edcf] px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[#005232] dark:bg-[#005232] dark:text-[#86f9ba]",
                  badgeVisibilityClass,
                )}
              >
                ATS
              </span>
            </Link>

            {isMobileDrawer && onCloseMobile ? (
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close navigation menu"
                className="rounded-lg p-1.5 text-[#3e4a41] transition-colors hover:bg-[#eff5ee] hover:text-[#171d19] md:hidden dark:text-[#b7c6ba]"
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
                  "rounded-lg p-1.5 text-[#3e4a41] transition-colors hover:bg-[#eff5ee] hover:text-[#171d19] dark:text-[#b7c6ba] dark:hover:bg-[#17231c]",
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
            <div className="flex justify-center py-2">
              <button
                type="button"
                onClick={() => setCollapsedOverride(false)}
                aria-label="Expand sidebar"
                title="Expand sidebar"
                className="rounded-lg p-1.5 text-[#3e4a41] transition-colors hover:bg-[#eff5ee] hover:text-[#006a42] dark:text-[#b7c6ba] dark:hover:bg-[#17231c]"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Active Search Status Indicator */}
          <div className={cn("px-4 py-1.5", isCollapsed ? "hidden" : isAutoResponsive ? "hidden xl:block" : "block")}>
            <Link
              href="/settings"
              onClick={onCloseMobile}
              className="flex items-center justify-between rounded-xl bg-[#eff5ee] px-3 py-2 transition-colors hover:bg-[#e3eae3] dark:bg-[#17231c] dark:hover:bg-[#1d2b23]"
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#006a42] animate-pulse dark:bg-[#69dca0]" />
                <span className="text-[12px] font-semibold text-[#171d19] dark:text-[#ecf3eb]">
                  Executive Pipeline
                </span>
              </div>
              <span className="text-[11px] font-medium text-[#3f674f] dark:text-[#a5d1b4]">
                Live
              </span>
            </Link>
          </div>

          {/* Grouped Navigation */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <div
              className={cn(
                "px-3 pb-1.5",
                isCollapsed ? "hidden" : isAutoResponsive ? "hidden xl:block" : "block",
              )}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3f674f] dark:text-[#a5d1b4]">
                Pipeline Management
              </span>
            </div>
            <nav className="flex flex-col gap-1" aria-label="Pipeline navigation">
              {renderNavGroup(
                PIPELINE_NAV_ITEMS,
                labelVisibilityClass,
                badgeVisibilityClass,
              )}
            </nav>

            <div
              className={cn(
                "px-3 pt-5 pb-1.5",
                isCollapsed ? "hidden" : isAutoResponsive ? "hidden xl:block" : "block",
              )}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#3f674f] dark:text-[#a5d1b4]">
                Career Assets
              </span>
            </div>
            <nav className="flex flex-col gap-1" aria-label="Career assets navigation">
              {renderNavGroup(
                ASSET_NAV_ITEMS,
                labelVisibilityClass,
                badgeVisibilityClass,
              )}
            </nav>
          </div>
        </div>

        {/* Bottom Settings + User Card */}
        <div className="space-y-2 p-3">
          <nav className="flex flex-col gap-1" aria-label="Settings navigation">
            {renderNavGroup(
              FOOTER_NAV_ITEMS,
              labelVisibilityClass,
              badgeVisibilityClass,
            )}
          </nav>

          <div className="flex items-center justify-between gap-2 rounded-xl bg-[#eff5ee] px-3 py-2.5 dark:bg-[#17231c]">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#c0edcf] text-[12px] font-bold text-[#005232] dark:bg-[#274f39] dark:text-[#c0edcf]">
                {getUserInitials(user.name)}
              </div>
              <div className={cn("min-w-0", labelVisibilityClass)}>
                <p className="truncate text-[13px] font-semibold text-[#171d19] dark:text-[#ecf3eb]">
                  {user.name}
                </p>
                <p className="truncate text-[11px] text-[#3f674f] dark:text-[#a5d1b4]">
                  {user.email}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              title="Sign out"
              aria-label="Sign out"
              className="shrink-0 rounded-lg p-1.5 text-[#3e4a41] transition-colors hover:bg-[#ffffff] hover:text-[#ba1a1a] dark:text-[#b7c6ba] dark:hover:bg-[#23342a]"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Responsive sidebar width: 72px on tablet or collapsed, 256px (w-64) on xl+ desktop
  const desktopAsideWidth =
    collapsedOverride === true
      ? "md:w-[72px]"
      : collapsedOverride === false
        ? "md:w-64"
        : "md:w-[72px] xl:w-64";

  return (
    <>
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 transition-[width] duration-200 md:block",
          desktopAsideWidth,
        )}
      >
        {renderSidebarContent(false)}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-[#171d19]/30 backdrop-blur-[2px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="elevation-4 relative z-10 w-64 max-w-[82vw]">
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}
    </>
  );
}
