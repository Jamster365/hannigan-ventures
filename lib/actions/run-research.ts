"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/current-member";
import { dataMode, isResearchConfigured } from "@/lib/config";

/** Manual "Run research now", gated by configuration, membership and daily budget. */
export async function runResearchNowAction(): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const member = await requireMember();
  if (dataMode() !== "supabase") return { ok: false, error: "Research runs require Supabase." };
  if (!isResearchConfigured()) return { ok: false, error: "OPENAI_API_KEY is not configured on the server." };
  const { runResearch } = await import("@/lib/research/run");
  const res = await runResearch({ runKind: "manual", triggeredBy: member.userId });
  revalidatePath("/", "layout");
  if (res.status === "failed") return { ok: false, error: res.errorSummary ?? "Run failed." };
  return { ok: true, message: `${res.status.replace("_", " ")}: ${res.summary}` };
}
