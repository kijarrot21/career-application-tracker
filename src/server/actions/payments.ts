"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { requireUser } from "@/lib/session";
import {
  createCheckoutInputSchema,
  createCreditCheckoutOrderService,
  reconcilePaymentOrderService,
} from "@/server/services/payments";

export async function createCheckoutOrderAction(
  input: z.input<typeof createCheckoutInputSchema>,
) {
  const user = await requireUser();
  const res = await createCreditCheckoutOrderService(user.id, input);
  revalidatePath("/credits");
  return res;
}

export async function reconcilePaymentOrderAction(orderId: string) {
  const user = await requireUser();
  const updated = await reconcilePaymentOrderService(user.id, orderId);
  revalidatePath("/credits");
  return updated;
}
