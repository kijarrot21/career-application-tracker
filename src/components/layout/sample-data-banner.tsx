"use client";

import { AlertCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { removeSampleDataAction } from "@/server/actions/settings";

export function SampleDataBanner({
  hasSampleData,
  sampleAppsCount,
  sampleJobsCount,
  realAppsCount,
}: {
  hasSampleData: boolean;
  sampleAppsCount: number;
  sampleJobsCount: number;
  realAppsCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (!hasSampleData) return null;

  function handleRemove() {
    startTransition(async () => {
      try {
        await removeSampleDataAction();
        toast.success("Sample demonstration data removed.");
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to remove sample data",
        );
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-warning-border bg-warning-soft px-4 py-2 text-xs text-warning-on-soft xl:px-8">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 text-warning" />
        <span className="tabular-nums">
          <strong>Sample data is loaded</strong> ({sampleJobsCount} sample jobs,{" "}
          {sampleAppsCount} sample applications, marked with a{" "}
          <span className="font-mono font-semibold">SAMPLE</span> badge).
          {realAppsCount > 0
            ? " Sample records are automatically excluded from your KPIs because you have real applications."
            : " Add a real application or remove sample data at any time."}
        </span>
      </div>
      <Button
        variant="secondary"
        size="sm"
        disabled={isPending}
        onClick={handleRemove}
        className="border-warning-border text-warning-on-soft"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {isPending ? "Removing..." : "Remove sample data"}
      </Button>
    </div>
  );
}
