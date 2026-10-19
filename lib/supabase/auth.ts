import "server-only";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "./server";

export async function siteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Passwordless sign-in. `shouldCreateUser: false` means an unknown address
 * never creates an account: only invited members (created through the
 * invitation flow) can sign in. The caller shows the same neutral message
 * either way.
 */
export async function sendMagicLink(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${await siteUrl()}/auth/callback?next=/` },
  });
  // Do not reveal whether the email is registered.
  if (error && !/signups not allowed|user not found/i.test(error.message)) {
    return { ok: false, error: "Could not send a sign-in link right now. Try again in a minute." };
  }
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}
