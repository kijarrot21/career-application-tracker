"use client";

import { Label } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

export function FormField({
  label,
  htmlFor,
  required,
  hint,
  error,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  const autoId = React.useId();
  const fieldId = htmlFor ?? autoId;

  const enhancedChild = React.isValidElement<{ id?: string }>(children) && !children.props.id
    ? React.cloneElement(children, { id: fieldId })
    : children;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label.Root
        htmlFor={fieldId}
        className="block text-xs font-semibold text-foreground"
      >
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-destructive">
            *
          </span>
        )}
      </Label.Root>
      {enhancedChild}
      {hint && !error && (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p role="alert" className="text-[11px] font-medium text-destructive-on-soft">
          {error}
        </p>
      )}
    </div>
  );
}
