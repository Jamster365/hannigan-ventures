import "server-only";
import { cache } from "react";
import type { Member } from "@/lib/domain/types";
import { createSupabaseServerClient } from "./server";
import type { HouseholdMemberRow, ProfileRow } from "./rows";

export interface SessionContext {
  member: Member;
  householdId: string;
}

/** The signed-in user's active household membership, cached per request. */
export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: membership }, { data: profile }] = await Promise.all([
    supabase.from("household_members").select("household_id, user_id, role, status, joined_at").eq("user_id", user.id).eq("status", "active").order("joined_at").limit(1).maybeSingle<HouseholdMemberRow>(),
    supabase.from("profiles").select("user_id, display_name, avatar_initial, accent").eq("user_id", user.id).maybeSingle<ProfileRow>(),
  ]);
  if (!membership) return null;
  return {
    householdId: membership.household_id,
    member: {
      userId: user.id,
      displayName: profile?.display_name ?? "Member",
      initial: profile?.avatar_initial ?? "M",
      accent: profile?.accent ?? "blue",
      role: membership.role,
      email: user.email ?? undefined,
      joinedAt: membership.joined_at,
    },
  };
});

export async function getSupabaseMember(): Promise<Member | null> {
  const ctx = await getSessionContext();
  return ctx?.member ?? null;
}

export async function requireSessionContext(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) throw new Error("Not signed in or not a household member");
  return ctx;
}
