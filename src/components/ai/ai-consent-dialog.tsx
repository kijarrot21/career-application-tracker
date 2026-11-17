"use client";

import { Cpu, ShieldAlert } from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import type { AiLocality, AiProviderId, AiUsageMetadata } from "@/lib/domain/ai";

export interface PendingConsentPrompt {
  jobId: string;
  provider: AiProviderId;
  locality: AiLocality;
  model: string;
  consentReason: string;
  estimatedUsage: AiUsageMetadata;
}

export function AiConsentDialog({
  pending,
  pendingAction,
  onApprove,
  onCancel,
}: {
  pending: PendingConsentPrompt | null;
  pendingAction: boolean;
  onApprove: (jobId: string) => void;
  onCancel: (jobId: string) => void;
}) {
  return (
    <Dialog
      open={Boolean(pending)}
      onOpenChange={(open) => {
        if (!open && pending && !pendingAction) {
          onCancel(pending.jobId);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-warning" />
            Confirm AI Processing
          </DialogTitle>
          <DialogDescription>
            {pending?.consentReason ??
              "Explicit confirmation is required before running this AI task."}
          </DialogDescription>
        </DialogHeader>

        {pending && (
          <div className="space-y-3 rounded-lg border border-border-subtle bg-surface-subtle p-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={pending.locality === "local" ? "success" : "warning"}>
                <Cpu className="mr-1 h-3 w-3" />
                {pending.locality === "local" ? "Local Processing" : "Cloud Transmission"}
              </Badge>
              <span className="font-mono text-foreground">
                {pending.provider} · {pending.model}
              </span>
            </div>
            <p className="text-muted-foreground tabular-nums">
              Estimated tokens: ~{pending.estimatedUsage.totalTokens} tokens
              {pending.locality === "cloud"
                ? " (API keys stay server-side; sensitive tokens & NIK patterns are minimized)"
                : " (Processed locally — zero external cloud transfer)"}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={pendingAction}
            onClick={() => pending && onCancel(pending.jobId)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={pendingAction || !pending}
            onClick={() => pending && onApprove(pending.jobId)}
          >
            {pendingAction ? "Running AI Task..." : "Approve & Run Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
