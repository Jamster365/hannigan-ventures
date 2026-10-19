import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. Server-only, used by the research runner, the seed
 * script and invitation delivery. Never import from client code. Each call
 * must target an explicit household id.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
