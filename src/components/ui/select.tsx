import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDown } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const selectVariants = cva(
  "w-full cursor-pointer appearance-none rounded-lg border pr-8 text-foreground transition-colors focus-visible:border-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      selectSize: {
        xs: "h-7 pl-2.5 pr-7 text-[11px]",
        sm: "h-8 pl-2.5 text-xs",
        md: "h-9 pl-3 text-xs",
        lg: "h-10 pl-3 text-xs",
      },
      tone: {
        default:
          "border-input-border bg-input hover:border-border-strong",
        subtle:
          "border-transparent bg-surface-subtle hover:border-border focus-visible:bg-input",
      },
    },
    defaultVariants: {
      selectSize: "md",
      tone: "default",
    },
  },
);

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement>,
    VariantProps<typeof selectVariants> {
  hasError?: boolean;
  wrapperClassName?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      wrapperClassName,
      selectSize,
      tone,
      hasError,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        className={cn("relative inline-flex w-full items-center", wrapperClassName)}
      >
        <select
          ref={ref}
          aria-invalid={hasError || undefined}
          className={cn(
            selectVariants({ selectSize, tone }),
            hasError && "border-destructive focus-visible:border-destructive",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-muted-foreground"
        />
      </div>
    );
  },
);
Select.displayName = "Select";
