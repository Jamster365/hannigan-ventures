import { NextResponse, type NextRequest } from "next/server";
import { dataMode, isResearchConfigured } from "@/lib/config";
import { authorisedSchedulerRequest } from "@/lib/research/tick-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Research scheduler heartbeat, called every 5 minutes by Supabase pg_cron.
 * Advances in-progress runs (their web research runs as a background job at
 * the provider) and starts the day's scheduled run at the configured London
 * hour. Each call stays well inside the hosting time limit.
 */
export async function POST(request: NextRequest) {
  if (!(await authorisedSchedulerRequest(request))) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const push = await pushFallback();
  if (!isResearchConfigured()) return NextResponse.json({ skipped: true, reason: "research not configured (Supabase + OPENAI_API_KEY required)", push });
  const { tickResearch } = await import("@/lib/research/run");
  return NextResponse.json({ ...(await tickResearch()), push });
}

export const GET = POST;

/** Phone notifications the trigger-driven dispatch missed (e.g. a failed call) go out here. */
async function pushFallback() {
  if (dataMode() !== "supabase") return null;
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    const { dispatchPush } = await import("@/lib/push/dispatch");
    return await dispatchPush(createSupabaseAdminClient());
  } catch (error) {
    return { error: (error as Error).message };
  }
}
