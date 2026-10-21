import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/next-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Secure auth callback: exchanges the PKCE code (or verifies a token hash)
 * for a session, then continues to an app-local path only. Links that carry
 * their tokens in the URL fragment (magic links and invites) arrive with
 * neither, so the server cannot see them: they go on to /auth/confirm,
 * which reads the fragment in the browser.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNextPath(searchParams.get("next"));

  if (!code && !(tokenHash && type)) return toConfirmPage(origin, next, searchParams.get("handoff"));

  const supabase = await createSupabaseServerClient();
  let error: { message: string } | null = null;
  if (code) ({ error } = await supabase.auth.exchangeCodeForSession(code));
  else ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type as "magiclink" | "invite" | "email" }));

  if (error) {
    // A second tap on a link that already worked: carry on if already signed in.
    const sessionUrl = new URL("/auth/session", origin);
    sessionUrl.searchParams.set("next", next);
    return NextResponse.redirect(sessionUrl);
  }
  return NextResponse.redirect(new URL(next, origin));
}

function toConfirmPage(origin: string, next: string, handoff: string | null): Response {
  // The browser keeps the URL fragment (the tokens) across this redirect.
  const url = new URL("/auth/confirm", origin);
  url.searchParams.set("next", next);
  if (handoff) url.searchParams.set("handoff", handoff);
  return NextResponse.redirect(url, 303);
}
