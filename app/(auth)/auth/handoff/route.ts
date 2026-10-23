import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { claimHandoff, confirmHandoff, pendingHandoffCode } from "@/lib/supabase/handoff";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Sign-in hand-off (see lib/supabase/handoff.ts).
 * - inspect: the link page asks which code the waiting device shows.
 * - confirm: the link page, after the member confirmed, passes the new session on.
 * - claim:   the waiting device polls with its secret; once confirmed, its cookies are set.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ ok: false }, { status: 403 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const str = (key: string) => (typeof body?.[key] === "string" ? (body[key] as string) : "");
  const id = str("id");
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  switch (str("action")) {
    case "inspect": {
      const code = await pendingHandoffCode(id);
      return NextResponse.json(code ? { status: "waiting", code } : { status: "gone" });
    }
    case "confirm": {
      const accessToken = str("access_token");
      const refreshToken = str("refresh_token");
      if (!accessToken || !refreshToken) return NextResponse.json({ ok: false }, { status: 400 });
      // Check the tokens are a real session before handing them on.
      const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await anon.auth.getUser(accessToken);
      if (error || !data.user) return NextResponse.json({ status: "invalid" }, { status: 401 });
      const ok = await confirmHandoff(id, accessToken, refreshToken, data.user.email);
      return NextResponse.json({ status: ok ? "handed_off" : "gone" });
    }
    case "claim": {
      const result = await claimHandoff(id, str("secret"));
      if (result.status !== "ready") return NextResponse.json({ status: result.status });
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.setSession({ access_token: result.accessToken, refresh_token: result.refreshToken });
      return NextResponse.json({ status: error ? "expired" : "signed_in" });
    }
    default:
      return NextResponse.json({ ok: false }, { status: 400 });
  }
}
