import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

export const textareaVariants = cva(
  "flex w-full rounded-lg border text-foreground placeholder:text-subtle-foreground transition-colors focus-visible:border-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 resize-y",
  {
    variants: {
      textareaSize: {
        sm: "min-h-[68px] px-2.5 py-2 text-xs leading-relaxed",
        md: "min-h-[84px] px-3 py-2 text-xs leading-relaxed",
        lg: "min-h-[96px] px-3.5 py-2.5 text-xs leading-relaxed",
      },
      tone: {
        default:
          "border-input-border bg-input hover:border-border-strong",
        subtle:
          "border-transparent bg-surface-subtle hover:border-border focus-visible:bg-input",
      },
    },
    defaultVariants: {
      textareaSize: "md",
      tone: "default",
    },
  },
);

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {
  hasError?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, textareaSize, tone, hasError, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        aria-invalid={hasError || undefined}
        className={cn(
          textareaVariants({ textareaSize, tone }),
          hasError && "border-destructive focus-visible:border-destructive",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
