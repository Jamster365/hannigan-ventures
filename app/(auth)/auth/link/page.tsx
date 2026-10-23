import { Wordmark } from "@/components/navigation/logo";

export const metadata = { title: "Sign in" };

/**
 * Landing page for a one-time sign-in link the owner sent directly. Signing in
 * happens only on the button tap, so message-app link previews that fetch
 * this page don't use the link up.
 */
export default async function SignInLinkPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const href = t ? `/auth/callback?token_hash=${encodeURIComponent(t)}&type=magiclink&next=/` : "/auth/sign-in";
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-page px-6 py-10">
      <Wordmark />
      <div className="mt-8 w-full max-w-[380px] rounded-[var(--radius-lg)] border border-hairline bg-surface p-6 text-center shadow-[var(--shadow-card)]">
        <h1 className="font-serif text-[1.5rem] font-semibold text-ink">{t ? "Your sign-in link" : "Link incomplete"}</h1>
        <p className="mt-1 text-[0.875rem] text-secondary">{t ? "Tap the button to sign in on this device. The link works once." : "This link is missing its code. Ask for a new one, or sign in with your email."}</p>
        <a href={href} className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-ink px-5 text-[0.9375rem] font-medium text-white">
          {t ? "Sign in" : "Go to sign in"}
        </a>
      </div>
    </div>
  );
}
