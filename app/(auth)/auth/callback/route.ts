import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Secure auth callback: exchanges the PKCE code (or verifies a token hash)
 * for a session, then continues to an app-local path only.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  const supabase = await createSupabaseServerClient();
  let error: { message: string } | null = null;
  if (code) ({ error } = await supabase.auth.exchangeCodeForSession(code));
  else if (tokenHash && type) ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as "magiclink" | "invite" | "email" }));
  else error = { message: "Missing sign-in code." };

  if (error) {
    const url = new URL("/auth/sign-in", origin);
    url.searchParams.set("error", "That sign-in link is invalid or has expired. Request a new one.");
    return NextResponse.redirect(url);
  }
  return NextResponse.redirect(new URL(next, origin));
}
