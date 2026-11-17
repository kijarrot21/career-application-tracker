import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg leading-none font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-white shadow-xs hover:bg-primary-hover active:scale-[0.98]",
        secondary:
          "border border-border bg-card text-secondary-foreground hover:border-border-strong hover:bg-secondary hover:text-foreground",
        ghost:
          "border border-transparent bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground",
        destructive:
          "border border-destructive-border bg-destructive-soft text-destructive-on-soft hover:border-destructive hover:bg-destructive hover:text-white",
        destructiveSolid:
          "bg-destructive text-white shadow-xs hover:bg-destructive-hover active:scale-[0.98]",
        warning:
          "bg-warning text-warning-foreground shadow-xs hover:opacity-90 active:scale-[0.98]",
        soft:
          "border border-primary/20 bg-primary-soft text-primary-on-soft hover:border-primary hover:bg-primary hover:text-white",
        outline:
          "border border-border bg-transparent text-foreground hover:border-border-strong hover:bg-secondary",
        link: "h-auto p-0 text-primary-text underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-7 rounded-md px-2.5 text-[11px]",
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-3.5 text-xs",
        lg: "h-10 px-4 text-xs",
        xl: "h-11 px-5 text-sm",
        icon: "h-9 w-9 p-0",
        "icon-sm": "h-8 w-8 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, type = "button", ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot.Root : "button";
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
