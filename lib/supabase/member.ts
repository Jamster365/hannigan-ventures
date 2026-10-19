import "server-only";
import type { Member } from "@/lib/domain/types";

/** Replaced in Milestone B with the Supabase-backed implementation. */
export async function getSupabaseMember(): Promise<Member | null> {
  return null;
}
