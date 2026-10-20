import { NextResponse, type NextRequest } from "next/server";
import { isResearchConfigured } from "@/lib/config";
import { authorisedSchedulerRequest } from "@/lib/research/tick-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Vercel Cron entry point (06:00 and 07:00 UTC, see vercel.json): a daily
 * fallback for the pg_cron heartbeat at /api/research/tick. It runs the same
 * tick, which starts the scheduled run only in the configured London hour
 * (correct across BST/GMT) and at most once per London day.
 *
 * `?force=1` (still secret-protected) starts the scheduled run regardless of the hour.
 */
export async function GET(request: NextRequest) {
  if (!(await authorisedSchedulerRequest(request))) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  if (!isResearchConfigured()) return NextResponse.json({ skipped: true, reason: "research not configured (Supabase + OPENAI_API_KEY required)" }, { status: 200 });
  const { tickResearch } = await import("@/lib/research/run");
  return NextResponse.json(await tickResearch({ forceStart: request.nextUrl.searchParams.get("force") === "1" }));
}

export const POST = GET;
