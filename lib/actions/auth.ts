"use server";

import { z } from "zod";
import { dataMode } from "@/lib/config";

export type MagicLinkState = { status: "idle" } | { status: "sent"; email: string } | { status: "error"; message: string };

const schema = z.object({ email: z.string().trim().email().max(200) });

/**
 * Request a passwordless sign-in link. Only emails that already belong to a
 * household member receive one; everyone else gets the same neutral message,
 * so the form never confirms whether an address is invited.
 */
export async function requestMagicLinkAction(_prev: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { status: "error", message: "Enter a valid email address." };
  if (dataMode() === "demo") return { status: "error", message: "Sign-in is not available in demo mode." };
  const { sendMagicLink } = await import("@/lib/supabase/auth");
  const res = await sendMagicLink(parsed.data.email);
  if (!res.ok) return { status: "error", message: res.error };
  return { status: "sent", email: parsed.data.email };
}
