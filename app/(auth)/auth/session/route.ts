import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/next-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const FAILED = "That sign-in link is invalid or has expired. Request a new one.";

/**
 * Finishes a sign-in whose tokens arrived in the link's URL fragment (the
 * implicit flow used for magic links and invites, which works whichever
 * browser opens the email). The callback page posts the tokens here; the
 * server checks them with Supabase and stores the session cookies.
 */
export async function POST(request: NextRequest) {
  // Same-origin only, so another site cannot sign a member into a different account.
  const origin = request.headers.get("origin");
  if (origin !== request.nextUrl.origin) return NextResponse.json({ ok: false }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { access_token?: unknown; refresh_token?: unknown } | null;
  const accessToken = typeof body?.access_token === "string" ? body.access_token : "";
  const refreshToken = typeof body?.refresh_token === "string" ? body.refresh_token : "";
  if (!accessToken || !refreshToken) return NextResponse.json({ ok: false }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (error) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true });
}

/**
 * Used when a link carried no usable tokens (most often a second tap on an
 * already-used link): continue if this browser is already signed in,
 * otherwise explain on the sign-in page.
 */
export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return NextResponse.redirect(new URL(next, request.nextUrl.origin));
  const url = new URL("/auth/sign-in", request.nextUrl.origin);
  url.searchParams.set("error", FAILED);
  return NextResponse.redirect(url);
}
