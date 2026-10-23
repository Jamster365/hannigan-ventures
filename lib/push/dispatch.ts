import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import type { NotificationType } from "@/lib/domain/types";
import { isPushable, PUSH_MAX_AGE_MS, PUSH_TYPES } from "./rules";

export function isPushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;
function configure() {
  if (configured) return;
  const subject = process.env.VAPID_SUBJECT || process.env.NEXT_PUBLIC_SITE_URL || "https://hannigan-ventures.vercel.app";
  webpush.setVapidDetails(subject, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushMessage {
  title: string;
  body: string;
  href: string;
  tag: string;
}

/** Sends one message to each subscription; drops subscriptions the push service says are gone. */
export async function sendToSubscriptions(admin: SupabaseClient, subs: SubscriptionRow[], message: PushMessage): Promise<{ sent: number; failed: number }> {
  configure();
  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(message), { TTL: 24 * 3600, urgency: "high" });
        sent++;
        await admin.from("push_subscriptions").update({ last_success_at: new Date().toISOString() }).eq("id", s.id);
      } catch (error) {
        failed++;
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
        else console.error("push failed", status ?? (error as Error).message);
      }
    }),
  );
  return { sent, failed };
}

/**
 * Claims unpushed, unread, recent notifications (one UPDATE, so concurrent
 * dispatches never send the same one twice) and sends them to the
 * recipients' phones. Called by a database trigger on new notifications and,
 * as a fallback, by the 5-minute research heartbeat.
 */
export async function dispatchPush(admin: SupabaseClient): Promise<{ claimed: number; sent: number; failed: number }> {
  if (!isPushConfigured()) return { claimed: 0, sent: 0, failed: 0 };
  const since = new Date(Date.now() - PUSH_MAX_AGE_MS).toISOString();
  const { data, error } = await admin
    .from("notifications")
    .update({ pushed_at: new Date().toISOString() })
    .is("pushed_at", null)
    .is("read_at", null)
    .in("notification_type", PUSH_TYPES)
    .gte("created_at", since)
    .select("id, recipient_user_id, notification_type, title, body, href, company_id")
    .returns<{ id: string; recipient_user_id: string; notification_type: NotificationType; title: string; body: string; href: string; company_id: string | null }[]>();
  if (error) throw new Error(`push claim: ${error.message}`);
  const due = (data ?? []).filter((n) => isPushable({ notificationType: n.notification_type, href: n.href }));
  if (!due.length) return { claimed: data?.length ?? 0, sent: 0, failed: 0 };

  const users = [...new Set(due.map((n) => n.recipient_user_id))];
  const { data: subs, error: subErr } = await admin.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", users).returns<SubscriptionRow[]>();
  if (subErr) throw new Error(`push subscriptions: ${subErr.message}`);

  let sent = 0;
  let failed = 0;
  for (const n of due) {
    const mine = (subs ?? []).filter((s) => s.user_id === n.recipient_user_id);
    if (!mine.length) continue;
    const r = await sendToSubscriptions(admin, mine, { title: n.title, body: n.body, href: n.href, tag: n.company_id ?? n.id });
    sent += r.sent;
    failed += r.failed;
  }
  return { claimed: data?.length ?? 0, sent, failed };
}
