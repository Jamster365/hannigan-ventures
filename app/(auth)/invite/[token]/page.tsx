import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/navigation/logo";
import { dataMode } from "@/lib/config";
import type { Params } from "@/lib/types/next";

export const metadata = { title: "Invitation" };

export default async function InvitePage({ params }: { params: Params<{ token: string }> }) {
  const { token } = await params;
  if (dataMode() === "demo") {
    return <Shell title="Invitations need the live app" body="This is the demo, which has no accounts. Invitations work in the live app." />;
  }
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return <Shell title="Sign in to accept" body="Open the invitation link from your email on this device, or request a sign-in link with the invited address." action={{ href: "/auth/sign-in", label: "Go to sign in" }} />;
  }
  const { redeemInvitation } = await import("@/lib/supabase/invitations");
  const res = await redeemInvitation(token);
  if (!res.ok) return <Shell title="Invitation not accepted" body={res.error} action={{ href: "/auth/sign-in", label: "Back to sign in" }} />;
  redirect("/");
}

function Shell({ title, body, action }: { title: string; body: string; action?: { href: string; label: string } }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-page px-6 py-10">
      <Wordmark />
      <div className="mt-8 w-full max-w-[380px] rounded-[var(--radius-lg)] border border-hairline bg-surface p-6 shadow-[var(--shadow-card)]">
        <h1 className="font-serif text-[1.5rem] font-semibold text-ink">{title}</h1>
        <p className="mt-2 text-[0.875rem] text-secondary">{body}</p>
        {action ? (
          <Link href={action.href} className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-ink px-5 text-[0.875rem] font-medium text-white">
            {action.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
