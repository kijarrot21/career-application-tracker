"use client";

import { Tabs as RadixTabs } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Tabs = RadixTabs.Root;

export const TabsList = React.forwardRef<
  React.ComponentRef<typeof RadixTabs.List>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.List> & {
    variant?: "underline" | "segmented";
  }
>(({ className, variant = "underline", ...props }, ref) => (
  <RadixTabs.List
    ref={ref}
    className={cn(
      variant === "segmented"
        ? "inline-flex items-center gap-1 rounded-xl bg-surface-subtle p-1"
        : "flex flex-wrap items-center gap-1 border-b border-border",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof RadixTabs.Trigger>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.Trigger> & {
    variant?: "underline" | "segmented";
  }
>(({ className, variant = "underline", ...props }, ref) => (
  <RadixTabs.Trigger
    ref={ref}
    className={cn(
      "inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
      variant === "segmented"
        ? "rounded-lg px-3.5 py-1.5 text-muted-foreground hover:text-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs dark:data-[state=active]:bg-primary dark:data-[state=active]:text-white"
        : "-mb-px border-b-2 border-transparent px-3.5 py-2.5 text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-primary-text",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = React.forwardRef<
  React.ComponentRef<typeof RadixTabs.Content>,
  React.ComponentPropsWithoutRef<typeof RadixTabs.Content>
>(({ className, ...props }, ref) => (
  <RadixTabs.Content
    ref={ref}
    className={cn("mt-4 focus-visible:outline-none", className)}
    {...props}
  />
));
TabsContent.displayName = "TabsContent";
