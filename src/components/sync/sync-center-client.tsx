"use client";

import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Clock,
  Database,
  GitMerge,
  History,
  Laptop,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import {
  SYNC_ENTITY_LABELS,
  SYNC_OPERATION_MODE_LABELS,
  SYNC_OPERATION_MODES,
  type SyncEntityType,
  type SyncOperationMode,
} from "@/lib/domain/sync";
import { formatDate } from "@/lib/format";
import {
  pullSyncChangesAction,
  pushDeviceOutboxAction,
  registerSyncDeviceAction,
  resolveSyncConflictAction,
  revokeSyncDeviceAction,
  updateDeviceModeAction,
} from "@/server/actions/sync";
import type { getSyncDashboardDataForUser } from "@/server/queries/sync";

type SyncDashboardData = Awaited<
  ReturnType<typeof getSyncDashboardDataForUser>
>;

function outboxStatusVariant(
  status: string,
): "warning" | "info" | "success" | "destructive" | "secondary" {
  switch (status) {
    case "pending":
      return "warning";
    case "in_flight":
      return "info";
    case "synced":
      return "success";
    case "conflict":
    case "failed":
      return "destructive";
    default:
      return "secondary";
  }
}

function conflictStatusVariant(
  status: string,
): "destructive" | "success" | "secondary" {
  if (status === "open") return "destructive";
  if (status === "dismissed") return "secondary";
  return "success";
}

function deviceStatusVariant(
  status: string,
): "success" | "warning" | "destructive" {
  if (status === "active") return "success";
  if (status === "paused") return "warning";
  return "destructive";
}

export function SyncCenterClient({ data }: { data: SyncDashboardData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [deviceKey, setDeviceKey] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [platform, setPlatform] = useState("macOS");
  const [operationMode, setOperationMode] =
    useState<SyncOperationMode>("local_only");

  const [mergedDrafts, setMergedDrafts] = useState<Record<string, string>>({});

  function handleRegisterDevice(e: React.FormEvent) {
    e.preventDefault();
    if (!deviceKey.trim() || !deviceName.trim()) {
      toast.error("Please enter both a device key and device name.");
      return;
    }

    startTransition(async () => {
      const res = await registerSyncDeviceAction({
        deviceKey: deviceKey.trim(),
        deviceName: deviceName.trim(),
        platform: platform.trim() || "web",
        operationMode,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Registered device '${res.device.deviceName}'.`);
      setDeviceKey("");
      setDeviceName("");
      router.refresh();
    });
  }

  function handleModeChange(deviceId: string, nextMode: SyncOperationMode) {
    startTransition(async () => {
      const res = await updateDeviceModeAction({
        deviceId,
        operationMode: nextMode,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Updated mode to ${SYNC_OPERATION_MODE_LABELS[nextMode]}.`);
      router.refresh();
    });
  }

  function handleRevoke(deviceId: string, name: string) {
    startTransition(async () => {
      const res = await revokeSyncDeviceAction(deviceId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Revoked device '${name}'.`);
      router.refresh();
    });
  }

  function handlePushOutbox(deviceId: string) {
    startTransition(async () => {
      const res = await pushDeviceOutboxAction({
        deviceId,
        ignoreBackoff: true,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.result.status === "idle") {
        toast.info("No pending or retryable outbox changes on this device.");
      } else if (res.result.status === "retry_scheduled") {
        toast.error(
          res.result.error ?? "Network interruption; retry scheduled in outbox.",
        );
      } else {
        toast.success(
          `Push finished: ${res.result.appliedCount} applied, ${res.result.mergedCount} merged, ${res.result.conflictCount} conflict(s).`,
        );
      }
      router.refresh();
    });
  }

  function handlePull(deviceId: string) {
    startTransition(async () => {
      const res = await pullSyncChangesAction({
        deviceId,
        streamKey: "default",
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Pulled ${res.result.events.length} incremental change(s) up to cursor #${res.result.nextCursor}.`,
      );
      router.refresh();
    });
  }

  function handleResolveConflict(
    conflictId: string,
    resolution: "keep_local" | "keep_cloud" | "merged" | "dismissed",
  ) {
    let mergedPayload: Record<string, unknown> | undefined;
    if (resolution === "merged") {
      const raw = mergedDrafts[conflictId]?.trim();
      if (!raw) {
        toast.error("Provide valid JSON in the merged payload editor first.");
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          toast.error("Merged payload must be a JSON object.");
          return;
        }
        mergedPayload = parsed as Record<string, unknown>;
      } catch {
        toast.error("Merged payload contains invalid JSON syntax.");
        return;
      }
    }

    startTransition(async () => {
      const res = await resolveSyncConflictAction({
        conflictId,
        resolution,
        mergedPayload,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Conflict resolved (${resolution.replace("_", " ")}).`);
      router.refresh();
    });
  }

  const checkpointByDevice = new Map(
    data.checkpoints.map((cp) => [cp.deviceId, cp]),
  );

  const openConflicts = data.conflicts.filter(
    (c) => c.resolutionStatus === "open",
  );
  const resolvedConflicts = data.conflicts.filter(
    (c) => c.resolutionStatus !== "open",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hybrid Local-Cloud Synchronization"
        description="Explicit outbox, incremental cloud cursor pull, and manual conflict resolution, without modifying your existing PGlite or PostgreSQL database mode."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.refresh()}
            disabled={isPending}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh Status
          </Button>
        }
      />

      {/* Approval Gate & Safety Notice */}
      <Card
        className={
          data.cloudSyncEnabled
            ? "border-info-border bg-info-soft/40"
            : "border-warning-border bg-warning-soft/50"
        }
      >
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-lg border border-border bg-surface p-2">
              {data.cloudSyncEnabled ? (
                <ShieldCheck className="h-4 w-4 text-info" />
              ) : (
                <Lock className="h-4 w-4 text-warning" />
              )}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {data.cloudSyncEnabled
                    ? "Sandbox Cloud Sync Active (SYNC_MODE=sandbox)"
                    : "Production Cloud Sync Locked (SYNC_MODE=disabled)"}
                </p>
                <Badge variant={data.cloudSyncEnabled ? "info" : "warning"}>
                  {data.syncMode}
                </Badge>
                <Badge variant="outline">
                  <Database className="mr-1 h-3 w-3" />
                  Engine: {data.databaseEngine}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Local offline outbox capture and device registration continue
                working offline. Credits, ledgers, and payments remain strictly
                cloud-authoritative and cannot be pushed from local devices.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Registered Devices</CardDescription>
            <CardTitle className="flex items-center justify-between text-2xl">
              <span>{data.summary.deviceCount}</span>
              <Laptop className="h-5 w-5 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {data.summary.activeDeviceCount} active endpoint(s)
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last Successful Sync</CardDescription>
            <CardTitle className="flex items-center justify-between text-base font-semibold">
              <span>
                {data.summary.lastSuccessfulSyncAt
                  ? formatDate(data.summary.lastSuccessfulSyncAt)
                  : "Never synced"}
              </span>
              <Clock className="h-5 w-5 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Latest cloud cursor: #{data.summary.latestCloudCursor}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Outbox Queue & Errors</CardDescription>
            <CardTitle className="flex items-center justify-between text-2xl">
              <span>
                {data.summary.pendingOutboxCount + data.summary.failedOutboxCount}
              </span>
              <ArrowUpFromLine className="h-5 w-5 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {data.summary.pendingOutboxCount} pending ·{" "}
            {data.summary.failedOutboxCount} retryable error(s)
          </CardContent>
        </Card>

        <Card
          className={
            data.summary.openConflictCount > 0 ? "border-destructive-border" : ""
          }
        >
          <CardHeader className="pb-2">
            <CardDescription>Open Sync Conflicts</CardDescription>
            <CardTitle className="flex items-center justify-between text-2xl">
              <span>{data.summary.openConflictCount}</span>
              <AlertTriangle
                className={`h-5 w-5 ${
                  data.summary.openConflictCount > 0
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {data.summary.openConflictCount > 0
              ? "Manual review required before overwriting data"
              : "No unresolved version conflicts"}
          </CardContent>
        </Card>
      </div>

      {/* Active Sync Errors Alert */}
      {data.summary.activeErrors.length > 0 && (
        <Card className="border-destructive-border bg-destructive-soft/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-destructive-on-soft">
              <XCircle className="h-4 w-4" />
              Active Synchronization Errors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            {data.summary.activeErrors.map((err, i) => (
              <div
                key={`${err.source}-${i}`}
                className="rounded-md border border-destructive-border/60 bg-surface px-3 py-2"
              >
                <span className="font-semibold">{err.source}:</span>{" "}
                <span className="text-muted-foreground">{err.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Conflict Notification & Manual Resolution Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitMerge className="h-4 w-4" />
            Conflict Notifications & Manual Resolution
          </CardTitle>
          <CardDescription>
            Conflicting edits are never silently overwritten. Inspect local vs
            cloud versions and pick a resolution explicitly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {openConflicts.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No open sync conflicts"
              description="All versioned records are clean, or conflicting edits have already been resolved."
            />
          ) : (
            <div className="space-y-4">
              {openConflicts.map((conflict) => {
                const entityLabel =
                  SYNC_ENTITY_LABELS[conflict.entityType as SyncEntityType] ??
                  conflict.entityType;
                const defaultMerged = JSON.stringify(
                  { ...conflict.cloudPayload, ...conflict.localPayload },
                  null,
                  2,
                );
                const draftValue = mergedDrafts[conflict.id] ?? defaultMerged;

                return (
                  <div
                    key={conflict.id}
                    className="space-y-3 rounded-xl border border-destructive-border bg-surface p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="destructive">Open Conflict</Badge>
                          <span className="text-sm font-semibold">
                            {entityLabel}
                          </span>
                          <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                            {conflict.entityId}
                          </code>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {conflict.conflictReason}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Local v{conflict.localVersion} vs Cloud v
                        {conflict.cloudVersion}
                      </span>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          Local Device Payload (v{conflict.localVersion})
                        </p>
                        <pre className="max-h-44 overflow-auto rounded-lg border border-border bg-muted/40 p-2.5 text-[11px] leading-relaxed">
                          {JSON.stringify(conflict.localPayload, null, 2)}
                        </pre>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          Cloud Authoritative Payload (v{conflict.cloudVersion})
                        </p>
                        <pre className="max-h-44 overflow-auto rounded-lg border border-border bg-muted/40 p-2.5 text-[11px] leading-relaxed">
                          {JSON.stringify(conflict.cloudPayload, null, 2)}
                        </pre>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        Optional Custom Merged JSON
                      </p>
                      <Textarea
                        rows={4}
                        className="font-mono text-xs"
                        value={draftValue}
                        onChange={(e) =>
                          setMergedDrafts((prev) => ({
                            ...prev,
                            [conflict.id]: e.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={isPending}
                        onClick={() =>
                          handleResolveConflict(conflict.id, "keep_local")
                        }
                      >
                        Keep Local
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() =>
                          handleResolveConflict(conflict.id, "keep_cloud")
                        }
                      >
                        Keep Cloud
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={isPending}
                        onClick={() =>
                          handleResolveConflict(conflict.id, "merged")
                        }
                      >
                        Save Merged Payload
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() =>
                          handleResolveConflict(conflict.id, "dismissed")
                        }
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {resolvedConflicts.length > 0 && (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recently Resolved Conflicts
              </p>
              <div className="space-y-1.5">
                {resolvedConflicts.slice(0, 6).map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant={conflictStatusVariant(c.resolutionStatus)}>
                        {c.resolutionStatus}
                      </Badge>
                      <span className="font-medium">{c.entityType}</span>
                      <code className="text-[11px] text-muted-foreground">
                        {c.entityId}
                      </code>
                    </div>
                    <span className="text-muted-foreground">
                      {c.resolvedAt ? formatDate(c.resolvedAt) : "-"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Device Management & Sync Controls */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" />
              Register Sync Device
            </CardTitle>
            <CardDescription>
              Bind an explicit local/hybrid device endpoint to your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegisterDevice} className="space-y-3">
              <FormField label="Device Key" required>
                <Input
                  placeholder="macbook-pro-local"
                  value={deviceKey}
                  onChange={(e) => setDeviceKey(e.target.value)}
                />
              </FormField>
              <FormField label="Device Name" required>
                <Input
                  placeholder="Work MacBook Pro"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                />
              </FormField>
              <FormField label="Platform">
                <Input
                  placeholder="macOS / web"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                />
              </FormField>
              <FormField label="Operation Mode">
                <Select
                  value={operationMode}
                  onChange={(e) =>
                    setOperationMode(e.target.value as SyncOperationMode)
                  }
                >
                  {SYNC_OPERATION_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {SYNC_OPERATION_MODE_LABELS[mode]}
                    </option>
                  ))}
                </Select>
              </FormField>
              <Button
                type="submit"
                className="w-full"
                size="sm"
                disabled={isPending}
              >
                Register Device
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Laptop className="h-4 w-4" />
              Device Endpoints & Checkpoints
            </CardTitle>
            <CardDescription>
              Switch between Local-Only offline, Cloud-Only, and Hybrid sync
              modes per device.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.devices.length === 0 ? (
              <EmptyState
                icon={Laptop}
                title="No sync devices registered"
                description="Register a local or hybrid device to track outbox changes and incremental sync cursors."
              />
            ) : (
              data.devices.map((device) => {
                const cp = checkpointByDevice.get(device.id);
                return (
                  <div
                    key={device.id}
                    className="space-y-3 rounded-xl border border-border bg-surface p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">
                            {device.deviceName}
                          </span>
                          <Badge variant={deviceStatusVariant(device.status)}>
                            {device.status}
                          </Badge>
                          <Badge variant="outline">{device.platform}</Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Key: <code>{device.deviceKey}</code> · Push cursor #
                          {cp?.lastPushCursor ?? 0} · Pull cursor #
                          {cp?.lastPullCursor ?? 0}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Last synced:{" "}
                          {device.lastSyncedAt
                            ? formatDate(device.lastSyncedAt)
                            : "Never"}
                        </p>
                      </div>

                      {device.status !== "revoked" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={isPending}
                          onClick={() =>
                            handleRevoke(device.id, device.deviceName)
                          }
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5 text-destructive" />
                          Revoke
                        </Button>
                      )}
                    </div>

                    {device.status !== "revoked" && (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="w-full sm:max-w-xs">
                          <Select
                            value={device.operationMode}
                            disabled={isPending}
                            onChange={(e) =>
                              handleModeChange(
                                device.id,
                                e.target.value as SyncOperationMode,
                              )
                            }
                          >
                            {SYNC_OPERATION_MODES.map((mode) => (
                              <option key={mode} value={mode}>
                                {SYNC_OPERATION_MODE_LABELS[mode]}
                              </option>
                            ))}
                          </Select>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              isPending ||
                              device.operationMode === "local_only" ||
                              !data.cloudSyncEnabled
                            }
                            onClick={() => handlePushOutbox(device.id)}
                          >
                            <ArrowUpFromLine className="mr-1.5 h-3.5 w-3.5" />
                            Push Outbox
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={
                              isPending ||
                              device.operationMode === "local_only" ||
                              !data.cloudSyncEnabled
                            }
                            onClick={() => handlePull(device.id)}
                          >
                            <ArrowDownToLine className="mr-1.5 h-3.5 w-3.5" />
                            Pull Changes
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Outbox & Sync Event History */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowUpFromLine className="h-4 w-4" />
              Pending & Recent Outbox
            </CardTitle>
            <CardDescription>
              Local changes queued for delivery and automatic exponential retry
              after network errors.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.outbox.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Outbox is empty"
                description="No pending or failed local mutations queued."
              />
            ) : (
              data.outbox.slice(0, 12).map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-1 rounded-lg border border-border p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={outboxStatusVariant(item.status)}>
                        {item.status}
                      </Badge>
                      <span className="font-medium">
                        {item.operation} {item.entityType}
                      </span>
                    </div>
                    <span className="text-muted-foreground">
                      v{item.baseVersion} → v{item.targetVersion}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <code>{item.entityId}</code>
                    <span>Retries: {item.retryCount}</span>
                  </div>
                  {item.lastError && (
                    <p className="text-[11px] text-destructive">
                      {item.lastError}
                    </p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              Cloud Sync Event Log
            </CardTitle>
            <CardDescription>
              Append-only monotonic cursor stream (#seq) supporting incremental
              multi-device pull.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.events.length === 0 ? (
              <EmptyState
                icon={History}
                title="No sync events recorded yet"
                description="Push outbox changes or pull incremental updates to populate the cursor log."
              />
            ) : (
              data.events.slice(0, 12).map((ev) => (
                <div
                  key={ev.id}
                  className="flex flex-col gap-1 rounded-lg border border-border p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">#{ev.seq}</Badge>
                      <Badge
                        variant={
                          ev.outcome === "conflict"
                            ? "destructive"
                            : ev.outcome === "merged"
                              ? "info"
                              : "success"
                        }
                      >
                        {ev.outcome}
                      </Badge>
                      <span className="font-medium">
                        {ev.direction} · {ev.operation} {ev.entityType}
                      </span>
                    </div>
                    <span className="text-muted-foreground">
                      v{ev.entityVersion}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <code>{ev.entityId}</code>
                    <span>{formatDate(ev.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
