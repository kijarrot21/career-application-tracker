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

const FILE_SIZE_CLASSES = {
  sm: "py-1 pl-1.5 pr-2.5 leading-[22px] file:h-[22px] file:leading-[22px]",
  md: "py-1 pl-1.5 pr-3 leading-[26px] file:h-[26px] file:leading-[26px]",
  lg: "py-1.5 pl-1.5 pr-3 leading-[26px] file:h-[26px] file:leading-[26px]",
  xl: "py-1.5 pl-2 pr-3.5 leading-[30px] file:h-[30px] file:leading-[30px]",
} as const;

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  hasError?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", inputSize, tone, hasError, ...props }, ref) => {
    const resolvedSize = inputSize ?? "md";
    const isFile = type === "file";

    return (
      <input
        ref={ref}
        type={type}
        aria-invalid={hasError || undefined}
        className={cn(
          inputVariants({ inputSize, tone }),
          isFile && [
            "block cursor-pointer file:mr-2.5 file:cursor-pointer file:rounded-md file:bg-surface-subtle file:px-2.5 file:py-0 file:align-middle hover:file:bg-border-subtle",
            FILE_SIZE_CLASSES[resolvedSize],
          ],
          hasError && "border-destructive focus-visible:border-destructive",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
