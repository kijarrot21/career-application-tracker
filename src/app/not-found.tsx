import Link from "next/link";
import { Button, ErrorState } from "@/components/ui";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <ErrorState
          title="Page not found"
          description="The requested job vacancy, application, or page does not exist or may have been removed."
          action={
            <Button variant="primary" size="md" asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}
