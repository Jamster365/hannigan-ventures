import "server-only";
import { cookies } from "next/headers";
import { dataMode } from "@/lib/config";
import { DEMO_MEMBERS } from "@/lib/demo/members";
import type { Member } from "@/lib/domain/types";

export const DEMO_MEMBER_COOKIE = "dr_demo_member";

/**
 * Resolve the signed-in household member.
 *  - Demo mode: a cookie selects which of the three sample members you are
 *    (so the 2-of-3 shortlist rule can be exercised without accounts).
 *  - Supabase mode: the authenticated user's household membership.
 * Returns null when nobody is signed in.
 */
export async function getCurrentMember(): Promise<Member | null> {
  if (dataMode() === "demo") {
    const jar = await cookies();
    const id = jar.get(DEMO_MEMBER_COOKIE)?.value;
    return DEMO_MEMBERS.find((m) => m.userId === id) ?? DEMO_MEMBERS[0];
  }
  const { getSupabaseMember } = await import("@/lib/supabase/member");
  return getSupabaseMember();
}

export async function requireMember(): Promise<Member> {
  const m = await getCurrentMember();
  if (!m) throw new Error("Not signed in");
  return m;
}
