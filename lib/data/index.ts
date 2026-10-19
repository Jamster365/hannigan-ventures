import "server-only";
import { dataMode } from "@/lib/config";
import { getDemoRepository } from "./demo-repository";
import type { Repository } from "./repository";

export async function getRepository(): Promise<Repository> {
  if (dataMode() === "supabase") {
    const { getSupabaseRepository } = await import("./supabase-repository");
    return getSupabaseRepository();
  }
  return getDemoRepository();
}

export type { Repository };
