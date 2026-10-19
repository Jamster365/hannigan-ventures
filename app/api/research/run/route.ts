import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { isResearchConfigured } from "@/lib/config";
import { londonDate, londonHour } from "@/lib/domain/format";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret || !header.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Scheduled research entry point (SPEC §8.1).
 *
 * Vercel Cron fires at 06:00 and 07:00 UTC (vercel.json). The handler runs the
 * research only when the Europe/London hour equals the configured local hour,
 * which makes the schedule correct across BST/GMT. The database's unique
 * (household, local_date, run_kind) constraint guarantees one run per London
 * calendar day even if both cron invocations qualify or a retry happens.
 *
 * `?force=1` (still secret-protected) bypasses the hour check for operators.
 */
export async function GET(request: NextRequest) {
  if (!authorised(request)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  if (!isResearchConfigured()) return NextResponse.json({ skipped: true, reason: "research not configured (Supabase + OPENAI_API_KEY required)" }, { status: 200 });
  const householdId = process.env.RESEARCH_HOUSEHOLD_ID;
  if (!householdId) return NextResponse.json({ error: "RESEARCH_HOUSEHOLD_ID not set" }, { status: 500 });

  const now = new Date();
  const force = request.nextUrl.searchParams.get("force") === "1";
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const admin = createSupabaseAdminClient();
  const { data: prompt } = await admin.from("research_prompts").select("config_jsonb").eq("household_id", householdId).eq("active", true).maybeSingle<{ config_jsonb: { researchTimeLocal?: string } }>();
  const configuredHour = Number((prompt?.config_jsonb?.researchTimeLocal ?? "07:00").split(":")[0]);
  const hour = londonHour(now);
  if (!force && hour !== configuredHour) {
    return NextResponse.json({ skipped: true, reason: `London hour ${hour} ≠ configured ${configuredHour}`, localDate: londonDate(now) });
  }

  const { runResearch } = await import("@/lib/research/run");
  const run = await runResearch({ runKind: "scheduled", triggeredBy: null, householdId, now });
  return NextResponse.json({ ok: run.status !== "failed", run });
}

export const POST = GET;
