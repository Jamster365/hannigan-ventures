import "server-only";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "./server";

export async function siteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  // Never trust request headers for the links we email in production.
  if (process.env.NODE_ENV === "production") return "https://hannigan-ventures.vercel.app";
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
export async function sendMagicLink(email: string, handoffId?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  // Implicit flow, not PKCE: the link carries the session itself, so it works
  // in whichever browser opens the email (on iPhone that is often not the one
  // that asked for it, and PKCE then fails with "invalid or expired").
  // /auth/callback passes them to /auth/confirm, which signs in that browser
  // or, with a hand-off id, the device that asked (see lib/supabase/handoff.ts).
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${await siteUrl()}/auth/callback?next=/${handoffId ? `&handoff=${handoffId}` : ""}` },
  });
  // Do not reveal whether the email is registered.
  if (error && !/signups not allowed|user not found/i.test(error.message)) {
    // The built-in Supabase sender allows only a few emails per hour for the whole project.
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      // Supabase also refuses a repeat request within a few seconds of the last one.
      if (/after \d+ seconds?/i.test(error.message)) return { ok: false, error: "A link was sent a moment ago. Wait a few seconds, then try again." };
      return { ok: false, error: "Too many sign-in emails have been sent in the last hour. Try again in about an hour." };
    }
    return { ok: false, error: "Could not send a sign-in link right now. Try again in a minute." };
  }
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}
