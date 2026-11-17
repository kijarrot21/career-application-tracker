import { AlertTriangle, Inbox, Loader2, RotateCcw } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      elevation="sm"
      padding="lg"
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className,
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-subtle text-primary-text">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-card-title text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-md text-caption text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}

export function LoadingState({
  label = "Loading workspace...",
  variant = "card",
  rows = 3,
  className,
}: {
  label?: string;
  variant?: "card" | "spinner" | "page";
  rows?: number;
  className?: string;
}) {
  if (variant === "spinner") {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "flex items-center justify-center gap-2 py-8 text-xs font-medium text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin text-primary-text" />
        <span>{label}</span>
      </div>
    );
  }

  if (variant === "page") {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={label}
        className={cn("mx-auto max-w-7xl space-y-6", className)}
      >
        <div className="space-y-2">
          <div className="h-4 w-36 animate-pulse rounded bg-surface-subtle" />
          <div className="h-7 w-72 animate-pulse rounded-lg bg-surface-subtle" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded bg-surface-subtle" />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} padding="md" className="space-y-3">
              <div className="h-3 w-24 animate-pulse rounded bg-surface-subtle" />
              <div className="h-8 w-16 animate-pulse rounded-lg bg-surface-subtle" />
              <div className="h-3 w-32 animate-pulse rounded bg-surface-subtle" />
            </Card>
          ))}
        </div>
        <Card padding="lg" className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="h-12 w-full animate-pulse rounded-lg bg-surface-subtle"
            />
          ))}
        </Card>
      </div>
    );
  }

  return (
    <Card
      role="status"
      aria-live="polite"
      aria-label={label}
      padding="md"
      className={cn("space-y-3", className)}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-10 w-full animate-pulse rounded-lg bg-surface-subtle"
        />
      ))}
    </Card>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "We could not load this view. Please try again.",
  onRetry,
  retryLabel = "Try again",
  action,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      role="alert"
      elevation="sm"
      padding="lg"
      className={cn(
        "flex flex-col items-center justify-center border-destructive-border py-12 text-center",
        className,
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive-soft text-destructive-on-soft">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="mt-3 text-card-title text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-caption text-muted-foreground">
        {description}
      </p>
      {(onRetry || action) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {onRetry && (
            <Button variant="secondary" size="md" onClick={onRetry}>
              <RotateCcw className="h-3.5 w-3.5" />
              {retryLabel}
            </Button>
          )}
          {action}
        </div>
      )}
    </Card>
  );
}
