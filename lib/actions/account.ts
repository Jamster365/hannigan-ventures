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
