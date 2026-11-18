"use client";

import {
  Archive,
  BarChart3,
  BookmarkCheck,
  Briefcase,
  CalendarClock,
  Coins,
  FileText,
  Kanban,
  LayoutDashboard,
  LogOut,
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Settings,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "@/components/i18n/locale-provider";
import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { signOut } from "@/lib/auth-client";
import type { TranslationMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface NavItem {
  key: Extract<keyof TranslationMessages["nav"], string>;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PIPELINE_NAV_ITEMS: NavItem[] = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "applications", href: "/applications", icon: Kanban },
  { key: "archive", href: "/archive", icon: Archive },
  { key: "interviews", href: "/interviews", icon: CalendarClock },
  { key: "analytics", href: "/analytics", icon: BarChart3 },
];

const ASSET_NAV_ITEMS: NavItem[] = [
  { key: "careerProfile", href: "/profile", icon: UserCheck },
  { key: "cvStudio", href: "/cv-studio", icon: Sparkles },
  { key: "jobs", href: "/jobs", icon: Briefcase },
  { key: "shortlist", href: "/shortlist", icon: BookmarkCheck },
  { key: "documents", href: "/documents", icon: FileText },
  { key: "emails", href: "/emails", icon: Mail },
];

const FOOTER_NAV_ITEMS: NavItem[] = [
  { key: "credits", href: "/credits", icon: Coins },
  { key: "sync", href: "/sync", icon: RefreshCw },
  { key: "settings", href: "/settings", icon: Settings },
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
  const { messages } = useTranslations();
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
    isCollapsed: boolean,
  ) {
    return items.map((item) => {
      const Icon = item.icon;
      const label = messages.nav[item.key];
      const active =
        pathname === item.href || pathname.startsWith(`${item.href}/`);

      const linkEl = (
        <Link
          key={item.key}
          href={item.href}
          onClick={onCloseMobile}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] leading-5 transition-all",
            isCollapsed && "justify-center px-0",
            active
              ? "bg-primary font-semibold text-white shadow-xs"
              : "font-medium text-muted-foreground hover:bg-surface-subtle hover:text-foreground",
          )}
        >
          <Icon
            className={cn(
              "h-[18px] w-[18px] shrink-0",
              active ? "text-white" : "text-primary-text",
            )}
          />
          <span className={cn("truncate", labelVisibilityClass)}>
            {label}
          </span>
        </Link>
      );

      if (isCollapsed) {
        return (
          <Tooltip key={item.key}>
            <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        );
      }

      return linkEl;
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
      <div className="flex h-full flex-col justify-between border-r border-border bg-card">
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Brand Header */}
          <div className="flex h-16 shrink-0 items-center justify-between px-4">
            <Link
              href="/dashboard"
              onClick={onCloseMobile}
              title="Trackr ATS | Executive Precision"
              className="flex items-center gap-2 font-display font-bold tracking-tight text-foreground"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-xs font-bold text-white shadow-xs">
                CT
              </span>
              <span className={cn("truncate text-[16px]", labelVisibilityClass)}>
                Trackr
              </span>
              <span
                className={cn(
                  "rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-primary-on-soft",
                  badgeVisibilityClass,
                )}
              >
                ATS
              </span>
            </Link>

            {isMobileDrawer && onCloseMobile ? (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onCloseMobile}
                aria-label="Close navigation menu"
                className="md:hidden"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() =>
                  setCollapsedOverride((prev) =>
                    prev === null ? true : !prev,
                  )
                }
                aria-label={
                  isCollapsed
                    ? messages.nav.expandSidebar
                    : messages.nav.collapseSidebar
                }
                title={
                  isCollapsed
                    ? messages.nav.expandSidebar
                    : messages.nav.collapseSidebar
                }
                className={cn(
                  isCollapsed
                    ? "hidden"
                    : isAutoResponsive
                      ? "hidden xl:inline-flex"
                      : "inline-flex",
                )}
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            )}
          </div>

          {!isMobileDrawer && isCollapsed && (
            <div className="flex justify-center py-2">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setCollapsedOverride(false)}
                aria-label={messages.nav.expandSidebar}
                title={messages.nav.expandSidebar}
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Active Search Status Indicator */}
          <div
            className={cn(
              "px-4 py-1.5",
              isCollapsed
                ? "hidden"
                : isAutoResponsive
                  ? "hidden xl:block"
                  : "block",
            )}
          >
            <Link
              href="/settings"
              onClick={onCloseMobile}
              className="flex items-center justify-between rounded-xl bg-surface-subtle px-3 py-2 transition-colors hover:bg-secondary-hover"
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                <span className="text-[12px] font-semibold text-foreground">
                  Executive Pipeline
                </span>
              </div>
              <span className="text-[11px] font-medium text-primary-text">
                Live
              </span>
            </Link>
          </div>

          {/* Grouped Navigation */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            <div
              className={cn(
                "px-3 pb-1.5",
                isCollapsed
                  ? "hidden"
                  : isAutoResponsive
                    ? "hidden xl:block"
                    : "block",
              )}
            >
              <span className="text-label-xs uppercase text-muted-foreground">
                {messages.nav.pipelineGroup}
              </span>
            </div>
            <nav
              className="flex flex-col gap-1"
              aria-label="Pipeline navigation"
              data-tour="sidebar-nav"
            >
              {renderNavGroup(
                PIPELINE_NAV_ITEMS,
                labelVisibilityClass,
                isCollapsed,
              )}
            </nav>

            <div
              className={cn(
                "px-3 pt-5 pb-1.5",
                isCollapsed
                  ? "hidden"
                  : isAutoResponsive
                    ? "hidden xl:block"
                    : "block",
              )}
            >
              <span className="text-label-xs uppercase text-muted-foreground">
                {messages.nav.assetsGroup}
              </span>
            </div>
            <nav
              className="flex flex-col gap-1"
              aria-label="Career assets navigation"
            >
              {renderNavGroup(
                ASSET_NAV_ITEMS,
                labelVisibilityClass,
                isCollapsed,
              )}
            </nav>
          </div>
        </div>

        {/* Bottom Settings + User Card */}
        <div className="space-y-2 border-t border-border-subtle p-3">
          <nav className="flex flex-col gap-1" aria-label="Settings navigation">
            {renderNavGroup(FOOTER_NAV_ITEMS, labelVisibilityClass, isCollapsed)}
          </nav>

          <div
            className={cn(
              "flex items-center gap-2 rounded-xl bg-surface-subtle p-2.5",
              isCollapsed
                ? "flex-col justify-center"
                : "justify-between md:flex-col xl:flex-row",
            )}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[12px] font-bold text-primary-on-soft">
                {getUserInitials(user.name)}
              </div>
              <div className={cn("min-w-0", labelVisibilityClass)}>
                <p className="truncate text-[13px] font-semibold text-foreground">
                  {user.name}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleSignOut}
              title={messages.nav.signOut}
              aria-label={messages.nav.signOut}
              className="shrink-0 hover:bg-destructive-soft hover:text-destructive-on-soft"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
            className="fixed inset-0 bg-foreground/30 backdrop-blur-[2px]"
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
