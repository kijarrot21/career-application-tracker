"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { SyncError } from "@/lib/domain/sync";
import { requireUser } from "@/lib/session";
import {
  pullSyncChangesService,
  pushDeviceOutboxService,
  registerDeviceSchema,
  registerSyncDeviceService,
  resolveConflictSchema,
  resolveSyncConflictService,
  revokeSyncDeviceService,
  syncPullSchema,
  updateDeviceModeSchema,
  updateDeviceSyncModeService,
} from "@/server/services/sync";

type ActionFailure = {
  ok: false;
  error: string;
  code?: string;
};

function toActionError(err: unknown): ActionFailure {
  if (err instanceof SyncError) {
    return { ok: false, error: err.message, code: err.code };
  }
  return {
    ok: false,
    error: err instanceof Error ? err.message : "Sync operation failed.",
  };
}

export async function registerSyncDeviceAction(
  input: z.input<typeof registerDeviceSchema>,
) {
  try {
    const user = await requireUser();
    const device = await registerSyncDeviceService(user.id, input);
    revalidatePath("/sync");
    return { ok: true as const, device };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateDeviceModeAction(
  input: z.input<typeof updateDeviceModeSchema>,
) {
  try {
    const user = await requireUser();
    const device = await updateDeviceSyncModeService(user.id, input);
    revalidatePath("/sync");
    return { ok: true as const, device };
  } catch (err) {
    return toActionError(err);
  }
}

export async function revokeSyncDeviceAction(deviceId: string) {
  try {
    const user = await requireUser();
    const device = await revokeSyncDeviceService(user.id, deviceId);
    revalidatePath("/sync");
    return { ok: true as const, device };
  } catch (err) {
    return toActionError(err);
  }
}

export async function pushDeviceOutboxAction(input: {
  deviceId: string;
  ignoreBackoff?: boolean;
}) {
  try {
    const user = await requireUser();
    const result = await pushDeviceOutboxService(user.id, {
      deviceId: input.deviceId,
      ignoreBackoff: input.ignoreBackoff ?? true,
    });
    revalidatePath("/sync");
    return { ok: true as const, result };
  } catch (err) {
    return toActionError(err);
  }
}

export async function pullSyncChangesAction(
  input: z.input<typeof syncPullSchema>,
) {
  try {
    const user = await requireUser();
    const result = await pullSyncChangesService(user.id, input);
    revalidatePath("/sync");
    return { ok: true as const, result };
  } catch (err) {
    return toActionError(err);
  }
}

export async function resolveSyncConflictAction(
  input: z.input<typeof resolveConflictSchema>,
) {
  try {
    const user = await requireUser();
    const result = await resolveSyncConflictService(user.id, input);
    revalidatePath("/sync");
    return { ok: true as const, result };
  } catch (err) {
    return toActionError(err);
  }
}
