import "server-only";
import { timingSafeEqual } from "node:crypto";

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Scheduler requests carry a bearer token: either Vercel Cron's CRON_SECRET, or
 * the pg_cron token, which lives only in Supabase Vault and is checked there by
 * a service-role-only function, so it is never copied into app configuration.
 */
export async function authorisedSchedulerRequest(request: Request): Promise<boolean> {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const token = header.slice(7);
  if (process.env.CRON_SECRET && same(token, process.env.CRON_SECRET)) return true;
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const { data } = await createSupabaseAdminClient().rpc("verify_research_tick", { token });
    return data === true;
  } catch {
    return false;
  }
}
