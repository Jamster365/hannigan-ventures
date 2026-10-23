"use server";

import { z } from "zod";
import { requireMember } from "@/lib/auth/current-member";
import { dataMode } from "@/lib/config";
import type { ActionResult } from "./family";

const subscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  userAgent: z.string().max(300).default(""),
});

const UNAVAILABLE = "Phone notifications work in the live app, not the demo.";

/** Saves this device's push subscription for the signed-in member (RLS: own rows only). */
export async function savePushSubscriptionAction(input: z.input<typeof subscriptionSchema>): Promise<ActionResult> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That device could not be registered." };
  if (dataMode() !== "supabase") return { ok: false, error: UNAVAILABLE };
  const member = await requireMember();
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  // An endpoint belongs to one browser; re-subscribing replaces it.
  await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({ user_id: member.userId, endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth, user_agent: parsed.data.userAgent });
  return error ? { ok: false, error: "Could not save this device. Try again." } : { ok: true };
}

export async function removePushSubscriptionAction(endpoint: string): Promise<ActionResult> {
  if (dataMode() !== "supabase") return { ok: true };
  await requireMember();
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return error ? { ok: false, error: "Could not turn off notifications on this device." } : { ok: true };
}

/** Sends a test notification to the signed-in member's devices. */
export async function sendTestPushAction(): Promise<ActionResult<{ sent: number }>> {
  if (dataMode() !== "supabase") return { ok: false, error: UNAVAILABLE };
  const member = await requireMember();
  const { isPushConfigured, sendToSubscriptions } = await import("@/lib/push/dispatch");
  if (!isPushConfigured()) return { ok: false, error: "Phone notifications are not set up on the server yet." };
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const admin = createSupabaseAdminClient();
  const { data: subs } = await admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").eq("user_id", member.userId);
  if (!subs?.length) return { ok: false, error: "No devices are registered for you yet." };
  const { sent } = await sendToSubscriptions(admin, subs, { title: "Hannigan Ventures", body: "Notifications are working on this device.", href: "/me", tag: "test" });
  return sent ? { ok: true, data: { sent } } : { ok: false, error: "The test could not be delivered. Try turning notifications off and on again." };
}
