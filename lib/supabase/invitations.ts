import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createSupabaseAdminClient } from "./admin";
import { siteUrl } from "./auth";
import { requireSessionContext } from "./member";
import { createSupabaseServerClient } from "./server";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function listInvitations(): Promise<{ id: string; email: string; status: string; expiresAt: string }[]> {
  const supabase = await createSupabaseServerClient();
  const { householdId } = await requireSessionContext();
  const { data } = await supabase.from("invitations").select("id, invited_email, status, expires_at").eq("household_id", householdId).order("created_at", { ascending: false }).limit(20);
  return (data ?? []).map((r) => ({ id: r.id as string, email: r.invited_email as string, status: r.status as string, expiresAt: r.expires_at as string }));
}

/**
 * Owner-only. Creates a single-use, 7-day invitation and sends the invitee a
 * Supabase invite email whose link lands on /invite/[token] after the auth
 * callback. The raw token is never stored; only its hash is.
 */
export async function createInvitation(ownerId: string, email: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const { householdId, member } = await requireSessionContext();
  if (member.role !== "owner" || member.userId !== ownerId) return { ok: false, error: "Only the household owner can invite." };

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const { error } = await supabase.from("invitations").insert({ household_id: householdId, invited_email: email.toLowerCase(), token_hash: hashToken(token), invited_by: ownerId, expires_at: expiresAt });
  if (error) return { ok: false, error: "Could not create the invitation." };

  try {
    const admin = createSupabaseAdminClient();
    const redirectTo = `${await siteUrl()}/auth/callback?next=${encodeURIComponent(`/invite/${token}`)}`;
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (inviteError) {
      // Existing user: send a magic link to the invite page instead.
      const { error: otpError } = await admin.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } });
      if (otpError) return { ok: false, error: `Invitation saved but the email could not be sent: ${otpError.message}` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invitation saved but the email could not be sent." };
  }
  return { ok: true, message: `Invitation sent to ${email}. It expires in 7 days.` };
}

/** Called from /invite/[token] after the invitee has signed in. */
export async function redeemInvitation(token: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("redeem_invitation", { p_token_hash: hashToken(token) });
  if (error) return { ok: false, error: error.message.includes("different email") ? "This invitation was sent to a different email address." : "This invitation is invalid or has expired." };
  return { ok: true };
}
