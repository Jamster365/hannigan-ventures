import { Wordmark } from "@/components/navigation/logo";
import { dataMode } from "@/lib/config";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const mode = dataMode();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-page px-6 py-10">
      <Wordmark />
      <div className="mt-8 w-full max-w-[380px] rounded-[var(--radius-lg)] border border-hairline bg-surface p-6 shadow-[var(--shadow-card)]">
        <h1 className="font-serif text-[1.5rem] font-semibold text-ink">Sign in</h1>
        <p className="mt-1 text-[0.875rem] text-secondary">Private household app. Only invited family members can sign in, by email link.</p>
        {error ? (
          <p className="mt-4 rounded-[12px] bg-red-pale px-3 py-2 text-[0.8125rem] text-red" role="alert">
            {error}
          </p>
        ) : null}
        <SignInForm mode={mode} />
      </div>
      <p className="mt-6 max-w-[380px] text-center text-[0.75rem] text-tertiary">Public sign-up is disabled. If you were invited, use the link in your invitation email.</p>
    </div>
  );
}
