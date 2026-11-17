"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, ErrorState } from "@/components/ui";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App route error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl py-12">
      <ErrorState
        title="Unable to load this workspace"
        description={
          error.message ||
          "An unexpected error occurred while loading your career data."
        }
        onRetry={reset}
        action={
          <Button variant="ghost" size="md" asChild>
            <Link href="/dashboard">Return to Dashboard</Link>
          </Button>
        }
      />
    </div>
  );
}
