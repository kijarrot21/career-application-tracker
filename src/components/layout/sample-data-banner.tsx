"use client";

import { AlertCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
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
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8c084]/60 bg-[#ffdead]/45 px-4 py-2 text-xs text-[#5d4211] xl:px-8 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 text-[#745725] dark:text-amber-400" />
        <span className="tabular-nums">
          <strong>Sample data is loaded</strong> ({sampleJobsCount} sample jobs,{" "}
          {sampleAppsCount} sample applications, marked with a{" "}
          <span className="font-mono font-semibold">SAMPLE</span> badge).
          {realAppsCount > 0
            ? " Sample records are automatically excluded from your KPIs because you have real applications."
            : " Add a real application or remove sample data at any time."}
        </span>
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={handleRemove}
        className="inline-flex items-center gap-1.5 rounded-xl border border-[#e8c084] bg-[#ffffff] px-3 py-1 text-xs font-semibold text-[#5d4211] shadow-2xs transition-colors hover:bg-[#ffdead]/40 disabled:opacity-50 dark:border-amber-800 dark:bg-[#111a15] dark:text-amber-200"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {isPending ? "Removing..." : "Remove sample data"}
      </button>
    </div>
  );
}
