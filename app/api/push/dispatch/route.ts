import { NextResponse, type NextRequest } from "next/server";
import { dataMode } from "@/lib/config";
import { authorisedSchedulerRequest } from "@/lib/research/tick-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sends new notifications to members' phones. Called by a Supabase trigger
 * (pg_net) whenever notifications are inserted; same bearer token as the
 * research heartbeat.
 */
export async function POST(request: NextRequest) {
  if (!(await authorisedSchedulerRequest(request))) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  if (dataMode() !== "supabase") return NextResponse.json({ skipped: true });
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const { dispatchPush } = await import("@/lib/push/dispatch");
  return NextResponse.json(await dispatchPush(createSupabaseAdminClient()));
}
