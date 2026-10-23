"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/auth/current-member";
import { dataMode } from "@/lib/config";

export type AccountActionState = { status: "idle" } | { status: "ok"; message: string } | { status: "error"; message: string };

export async function updateDisplayNameAction(_prev: AccountActionState, formData: FormData): Promise<AccountActionState> {
  const parsed = z.object({ displayName: z.string().trim().min(1).max(40) }).safeParse({ displayName: formData.get("displayName") });
  if (!parsed.success) return { status: "error", message: "Enter a name between 1 and 40 characters." };
  if (dataMode() === "demo") return { status: "error", message: "Not available in demo mode." };
  const member = await requireMember();
  const { updateDisplayName } = await import("@/lib/supabase/account");
  const res = await updateDisplayName(member.userId, parsed.data.displayName);
  if (!res.ok) return { status: "error", message: res.error };
  revalidatePath("/", "layout");
  return { status: "ok", message: "Saved." };
}

export async function inviteMemberAction(_prev: AccountActionState, formData: FormData): Promise<AccountActionState> {
  const parsed = z.object({ email: z.string().trim().email().max(200) }).safeParse({ email: formData.get("email") });
  if (!parsed.success) return { status: "error", message: "Enter a valid email." };
  if (dataMode() === "demo") return { status: "error", message: "Not available in demo mode." };
  const member = await requireMember();
  if (member.role !== "owner") return { status: "error", message: "Only the household owner can send invitations." };
  const { createInvitation } = await import("@/lib/supabase/invitations");
  const res = await createInvitation(member.userId, parsed.data.email);
  if (!res.ok) return { status: "error", message: res.error };
  revalidatePath("/account");
  return { status: "ok", message: res.message };
}

export async function signOutAction(): Promise<void> {
  if (dataMode() === "demo") return;
  const { signOut } = await import("@/lib/supabase/auth");
  await signOut();
  redirect("/auth/sign-in");
}

/**
 * Owner only: a one-time sign-in link for another household member, to send
 * them directly (e.g. on WhatsApp) when the sign-in email doesn't arrive.
 * Nothing is emailed. The link opens /auth/link, which signs in only when the
 * member taps the button, so link previews can't use it up. It works once and
 * expires after the project's email-link lifetime (one hour by default).
 */
export async function createSignInLinkAction(userId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (dataMode() === "demo") return { ok: false, error: "Not available in demo mode." };
  const member = await requireMember();
  if (member.role !== "owner") return { ok: false, error: "Only the household owner can create sign-in links." };
  if (userId === member.userId) return { ok: false, error: "Use the sign-in page for your own account." };
  const [{ getSessionContext }, { createSupabaseAdminClient }] = await Promise.all([import("@/lib/supabase/member"), import("@/lib/supabase/admin")]);
  const ctx = await getSessionContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  const admin = createSupabaseAdminClient();
  const { data: row } = await admin.from("household_members").select("user_id").eq("household_id", ctx.householdId).eq("user_id", userId).eq("status", "active").maybeSingle();
  if (!row) return { ok: false, error: "That person isn't an active member of this household." };
  const { data: target, error: userError } = await admin.auth.admin.getUserById(userId);
  if (userError || !target.user?.email) return { ok: false, error: "Couldn't find that member's account." };
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: target.user.email });
  if (error || !data.properties?.hashed_token) return { ok: false, error: "Couldn't create a link. Try again in a minute." };
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://hannigan-ventures.vercel.app";
  return { ok: true, url: `${site}/auth/link?t=${encodeURIComponent(data.properties.hashed_token)}` };
}
