"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/primitives";
import { requestMagicLinkAction, type MagicLinkState } from "@/lib/actions/auth";

export function SignInForm({ mode }: { mode: "demo" | "supabase" }) {
  const [state, action, pending] = useActionState<MagicLinkState, FormData>(requestMagicLinkAction, { status: "idle" });

  if (mode === "demo") {
    return (
      <div className="mt-5">
        <p className="rounded-[12px] bg-amber-pale px-3 py-2 text-[13px] text-amber">Demo mode: Supabase is not configured, so sign-in is bypassed and you are viewing as a sample member.</p>
        <Link href="/" className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-ink px-5 text-[14px] font-medium text-white">
          Continue to the demo
        </Link>
      </div>
    );
  }

  if (state.status === "sent") {
    return (
      <div className="mt-5 rounded-[12px] bg-green-pale px-3 py-3 text-[14px] text-green" role="status">
        Check your email. If <span className="font-semibold">{state.email}</span> belongs to an invited member, a sign-in link is on its way.
      </div>
    );
  }

  return (
    <form action={action} className="mt-5 space-y-3">
      <label className="block">
        <span className="text-[13px] font-medium text-ink">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          className="mt-1 block min-h-[44px] w-full rounded-[12px] border border-hairline-strong bg-surface px-3 text-[15px] text-ink focus:border-blue"
          placeholder="you@example.com"
        />
      </label>
      {state.status === "error" ? (
        <p className="text-[13px] text-red" role="alert">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
