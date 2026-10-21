import { Wordmark } from "@/components/navigation/logo";
import { ConfirmSignIn } from "./confirm-sign-in";

export const metadata = { title: "Signing in" };

export default function ConfirmPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-page px-6 py-10">
      <Wordmark />
      <div className="mt-8 w-full max-w-[380px] rounded-[var(--radius-lg)] border border-hairline bg-surface p-6 shadow-[var(--shadow-card)]">
        <ConfirmSignIn />
      </div>
    </div>
  );
}
