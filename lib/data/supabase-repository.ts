import "server-only";
import type { Repository } from "./repository";

/** Replaced in Milestone B with the Postgres-backed implementation. */
export function getSupabaseRepository(): Repository {
  throw new Error("Supabase repository not implemented yet");
}
