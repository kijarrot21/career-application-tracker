"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export function DataTableContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "elevation-1 overflow-hidden rounded-xl border border-border bg-card",
        className,
      )}
    >
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function DataTableRoot({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn("w-full border-collapse text-left text-[13px]", className)}
      {...props}
    />
  );
}

export function DataTableHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "border-b border-border bg-surface-subtle text-label-xs uppercase text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function DataTableBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn("divide-y divide-border-subtle", className)}
      {...props}
    />
  );
}

export function DataTableRow({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "transition-colors hover:bg-surface-subtle/60",
        className,
      )}
      {...props}
    />
  );
}

export function DataTableHead({
  className,
  sortDirection,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & {
  sortDirection?: "asc" | "desc" | "none";
}) {
  const ariaSort =
    sortDirection === "asc"
      ? "ascending"
      : sortDirection === "desc"
        ? "descending"
        : sortDirection === "none"
          ? "none"
          : undefined;

  return (
    <th
      aria-sort={ariaSort}
      className={cn("px-4 py-3 font-semibold whitespace-nowrap", className)}
      {...props}
    />
  );
}

export function DataTableSortButton({
  active,
  direction,
  onClick,
  children,
}: {
  active?: boolean;
  direction?: "asc" | "desc";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-primary-text focus-visible:outline-none focus-visible:underline",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {children}
      {active ? (
        direction === "asc" ? (
          <ArrowUp className="h-3 w-3 text-primary-text" />
        ) : (
          <ArrowDown className="h-3 w-3 text-primary-text" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-60" />
      )}
    </button>
  );
}

export function DataTableCell({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3.5 align-middle", className)} {...props} />;
}

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  align?: "left" | "right";
  sortKey?: string;
  className?: string;
  render: (row: T) => React.ReactNode;
}

export function DataTable<T>({
  data,
  columns,
  rowKey,
  emptyMessage = "No records found.",
  sortKey,
  sortDirection,
  onSort,
  className,
}: {
  data: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (key: string) => void;
  className?: string;
}) {
  return (
    <DataTableContainer className={className}>
      <DataTableRoot>
        <DataTableHeader>
          <tr>
            {columns.map((col) => {
              const isSorted = Boolean(col.sortKey && sortKey === col.sortKey);
              return (
                <DataTableHead
                  key={col.key}
                  sortDirection={
                    col.sortKey
                      ? isSorted
                        ? sortDirection
                        : "none"
                      : undefined
                  }
                  className={cn(
                    col.align === "right" && "text-right",
                    col.className,
                  )}
                >
                  {col.sortKey && onSort ? (
                    <DataTableSortButton
                      active={isSorted}
                      direction={sortDirection}
                      onClick={() => onSort(col.sortKey!)}
                    >
                      {col.header}
                    </DataTableSortButton>
                  ) : (
                    col.header
                  )}
                </DataTableHead>
              );
            })}
          </tr>
        </DataTableHeader>
        <DataTableBody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-body-sm text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <DataTableRow key={rowKey(row)}>
                {columns.map((col) => (
                  <DataTableCell
                    key={col.key}
                    className={cn(
                      col.align === "right" && "text-right",
                      col.className,
                    )}
                  >
                    {col.render(row)}
                  </DataTableCell>
                ))}
              </DataTableRow>
            ))
          )}
        </DataTableBody>
      </DataTableRoot>
    </DataTableContainer>
  );
}
