import { NextResponse } from "next/server";
import { dataMode } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * Live progress of the household's most recent research run, polled by the
 * "Run research now" UI while the run's server action is still in flight.
 * Reads through the member's own session, so RLS limits it to their household.
 */
export async function GET() {
  if (dataMode() !== "supabase") return NextResponse.json({ run: null });
  const [{ getSessionContext }, { createSupabaseServerClient }] = await Promise.all([import("@/lib/supabase/member"), import("@/lib/supabase/server")]);
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("research_runs")
    .select("id, status, started_at, progress_stage, progress_detail, progress_at")
    .eq("household_id", ctx.householdId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; status: string; started_at: string; progress_stage: string | null; progress_detail: string | null; progress_at: string | null }>();
  return NextResponse.json(
    { run: data ? { id: data.id, status: data.status, startedAt: data.started_at, stage: data.progress_stage, detail: data.progress_detail, updatedAt: data.progress_at } : null },
    { headers: { "cache-control": "no-store" } },
  );
}
