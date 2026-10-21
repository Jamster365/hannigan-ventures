import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/auth/next-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Secure auth callback: exchanges the PKCE code (or verifies a token hash)
 * for a session, then continues to an app-local path only. Links that carry
 * their tokens in the URL fragment (magic links and invites) arrive with
 * neither, so the server cannot see them: it returns a tiny page that hands
 * the fragment to /auth/session instead.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNextPath(searchParams.get("next"));

  if (!code && !(tokenHash && type)) return fragmentPage(next);

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

function fragmentPage(next: string): Response {
  const nextJson = JSON.stringify(next).replace(/</g, "\\u003c");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Signing in…</title><meta name="robots" content="noindex">
<style>body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#f6f4ef;color:#1d1d1f;font:15px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}</style>
</head><body><p>Signing you in…</p>
<script>
(function () {
  var next = ${nextJson};
  var done = "/auth/session?next=" + encodeURIComponent(next);
  var params = new URLSearchParams(location.hash.slice(1));
  var access = params.get("access_token");
  var refresh = params.get("refresh_token");
  history.replaceState(null, "", location.pathname + location.search);
  if (!access || !refresh) { location.replace(done); return; }
  fetch("/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ access_token: access, refresh_token: refresh })
  }).then(function (r) { location.replace(r.ok ? next : done); }, function () { location.replace(done); });
})();
</script></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
