import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDown } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const selectVariants = cva(
  "w-full cursor-pointer appearance-none rounded-lg border pr-7 text-foreground transition-colors focus-visible:border-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      selectSize: {
        xs: "h-7 pl-2.5 pr-6 text-[11px]",
        sm: "h-8 pl-2.5 pr-7 text-xs",
        md: "h-9 pl-3 pr-7 text-xs",
        lg: "h-10 pl-3 pr-7 text-xs",
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

const WIDTH_TOKEN_RE = /^(?:[a-z0-9-]+:)*(?:w|min-w|max-w)-.+$/;

function splitWidthClasses(className?: string): {
  widthClasses: string[];
  selectClasses: string[];
} {
  if (!className) return { widthClasses: [], selectClasses: [] };
  const widthClasses: string[] = [];
  const selectClasses: string[] = [];
  for (const token of className.trim().split(/\s+/)) {
    if (!token) continue;
    if (WIDTH_TOKEN_RE.test(token)) {
      widthClasses.push(token);
    } else {
      selectClasses.push(token);
    }
  }
  return { widthClasses, selectClasses };
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
    // Keep width utilities on the wrapper so the chevron icon stays anchored to the select edge.
    const { widthClasses, selectClasses } = splitWidthClasses(className);
    const chevronRight = selectSize === "xs" ? "right-1.5" : "right-2";

    return (
      <div
        className={cn(
          "relative inline-flex w-full items-center",
          widthClasses,
          wrapperClassName,
        )}
      >
        <select
          ref={ref}
          aria-invalid={hasError || undefined}
          className={cn(
            selectVariants({ selectSize, tone }),
            hasError && "border-destructive focus-visible:border-destructive",
            selectClasses,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute h-3.5 w-3.5 text-muted-foreground",
            chevronRight,
          )}
        />
      </div>
    );
  },
);
Select.displayName = "Select";
