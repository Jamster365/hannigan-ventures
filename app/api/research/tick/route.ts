import { NextResponse, type NextRequest } from "next/server";
import { isResearchConfigured } from "@/lib/config";
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
  if (!isResearchConfigured()) return NextResponse.json({ skipped: true, reason: "research not configured (Supabase + OPENAI_API_KEY required)" });
  const { tickResearch } = await import("@/lib/research/run");
  return NextResponse.json(await tickResearch());
}

export const GET = POST;
