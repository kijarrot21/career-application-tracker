import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

export const inputVariants = cva(
  "flex w-full rounded-lg border text-foreground placeholder:text-subtle-foreground transition-colors file:border-0 file:bg-transparent file:text-xs file:font-semibold file:text-foreground focus-visible:border-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      inputSize: {
        sm: "h-8 px-2.5 text-xs",
        md: "h-9 px-3 text-xs",
        lg: "h-10 px-3 text-xs",
        xl: "h-11 px-3.5 text-sm",
      },
      tone: {
        default:
          "border-input-border bg-input hover:border-border-strong",
        subtle:
          "border-transparent bg-surface-subtle hover:border-border focus-visible:bg-input",
      },
    },
    defaultVariants: {
      inputSize: "md",
      tone: "default",
    },
  },
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  hasError?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", inputSize, tone, hasError, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        aria-invalid={hasError || undefined}
        className={cn(
          inputVariants({ inputSize, tone }),
          hasError && "border-destructive focus-visible:border-destructive",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
