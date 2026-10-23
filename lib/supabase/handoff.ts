import "server-only";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { createSupabaseAdminClient } from "./admin";

/**
 * Sign-in hand-off between browsers (see migration 0011). The requesting
 * device holds the secret; the email link only carries the id, so having the
 * link alone never lets anyone claim the session on another device, and the
 * member confirms a matching code before the session is handed over.
 */

const TTL_MS = 60 * 60 * 1000; // matches the magic-link lifetime
const CLAIM_WINDOW_MS = 10 * 60 * 1000;

export type Handoff = { id: string; secret: string; code: string };
type Row = { id: string; secret_hash: string; code: string; email: string | null; access_token: string | null; refresh_token: string | null; confirmed_at: string | null; created_at: string };

const hash = (secret: string) => createHash("sha256").update(secret).digest("hex");
const expired = (row: Row) => Date.now() - new Date(row.created_at).getTime() > TTL_MS || (row.confirmed_at !== null && Date.now() - new Date(row.confirmed_at).getTime() > CLAIM_WINDOW_MS);

export async function createHandoff(email: string): Promise<Handoff> {
  const admin = createSupabaseAdminClient();
  await admin.from("auth_handoffs").delete().lt("created_at", new Date(Date.now() - 2 * TTL_MS).toISOString());
  const secret = randomBytes(32).toString("base64url");
  const code = String(randomInt(100, 1000));
  const { data, error } = await admin.from("auth_handoffs").insert({ secret_hash: hash(secret), code, email: email.trim().toLowerCase() }).select("id").single<{ id: string }>();
  if (error || !data) throw new Error(`could not create sign-in hand-off: ${error?.message ?? "no row"}`);
  return { id: data.id, secret, code };
}

async function load(id: string): Promise<Row | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createSupabaseAdminClient().from("auth_handoffs").select("*").eq("id", id).maybeSingle<Row>();
  return data && !expired(data) ? data : null;
}

/** The code the waiting device shows, for the link page to display; null when the hand-off is gone or already used. */
export async function pendingHandoffCode(id: string): Promise<string | null> {
  const row = await load(id);
  return row && !row.confirmed_at ? row.code : null;
}

/** Called from the link page once the member confirmed the code. Tokens must already be validated, and must belong to the email the hand-off was made for. */
export async function confirmHandoff(id: string, accessToken: string, refreshToken: string, sessionEmail: string | undefined): Promise<boolean> {
  const row = await load(id);
  if (!row || row.confirmed_at) return false;
  if (!row.email || !sessionEmail || row.email !== sessionEmail.trim().toLowerCase()) return false;
  const { error } = await createSupabaseAdminClient()
    .from("auth_handoffs")
    .update({ access_token: accessToken, refresh_token: refreshToken, confirmed_at: new Date().toISOString() })
    .eq("id", id)
    .is("confirmed_at", null);
  return !error;
}

/** Called by the waiting device. Returns the tokens once (the row is deleted), "pending" while waiting. */
export async function claimHandoff(id: string, secret: string): Promise<{ status: "pending" } | { status: "expired" } | { status: "ready"; accessToken: string; refreshToken: string }> {
  const row = await load(id);
  if (!row) return { status: "expired" };
  const a = Buffer.from(hash(secret));
  const b = Buffer.from(row.secret_hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { status: "expired" };
  if (!row.access_token || !row.refresh_token) return { status: "pending" };
  await createSupabaseAdminClient().from("auth_handoffs").delete().eq("id", id);
  return { status: "ready", accessToken: row.access_token, refreshToken: row.refresh_token };
}
