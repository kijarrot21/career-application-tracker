import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[2px] text-[11px] leading-[15px] font-semibold tracking-[0.02em] transition-colors",
  {
    variants: {
      variant: {
        default: "border-border bg-secondary text-secondary-foreground",
        primary: "border-primary/25 bg-primary-soft text-primary-on-soft",
        secondary: "border-border-subtle bg-muted text-muted-foreground",
        success: "border-success-border bg-success-soft text-success-on-soft",
        warning: "border-warning-border bg-warning-soft text-warning-on-soft",
        destructive:
          "border-destructive-border bg-destructive-soft text-destructive-on-soft",
        info: "border-info-border bg-info-soft text-info-on-soft",
        outline: "border-border bg-transparent text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
