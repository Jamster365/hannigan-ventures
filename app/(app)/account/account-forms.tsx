"use client";

import { useActionState } from "react";
import { Button, Card } from "@/components/ui/primitives";
import { inviteMemberAction, signOutAction, updateDisplayNameAction, type AccountActionState } from "@/lib/actions/account";
import type { Member } from "@/lib/domain/types";

export function AccountForms({ mode, member, invitations }: { mode: "demo" | "supabase"; member: Member; invitations: { id: string; email: string; status: string; expiresAt: string }[] }) {
  const [nameState, nameAction, namePending] = useActionState<AccountActionState, FormData>(updateDisplayNameAction, { status: "idle" });
  const [inviteState, inviteAction, invitePending] = useActionState<AccountActionState, FormData>(inviteMemberAction, { status: "idle" });

  return (
    <>
      <section className="mt-5">
        <h2 className="mb-2 font-serif text-[18px] font-semibold text-ink">Display name</h2>
        <Card className="p-4">
          <form action={nameAction} className="flex flex-col gap-2 sm:flex-row">
            <input name="displayName" defaultValue={member.displayName} maxLength={40} required className="min-h-[44px] flex-1 rounded-[12px] border border-hairline-strong bg-surface px-3 text-[15px] text-ink" aria-label="Display name" />
            <Button type="submit" variant="outline" disabled={namePending || mode === "demo"}>
              Save
            </Button>
          </form>
          <StatusLine state={nameState} demo={mode === "demo"} />
        </Card>
      </section>

      {member.role === "owner" ? (
        <section className="mt-5">
          <h2 className="mb-2 font-serif text-[18px] font-semibold text-ink">Invitations</h2>
          <Card className="p-4">
            <p className="text-[13px] text-secondary">Invite a family member by email. They receive a single-use link that expires in 7 days. Public sign-up is disabled.</p>
            <form action={inviteAction} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input name="email" type="email" required placeholder="family@example.com" className="min-h-[44px] flex-1 rounded-[12px] border border-hairline-strong bg-surface px-3 text-[15px] text-ink" aria-label="Email to invite" />
              <Button type="submit" disabled={invitePending || mode === "demo"}>
                Send invitation
              </Button>
            </form>
            <StatusLine state={inviteState} demo={mode === "demo"} />
            {invitations.length ? (
              <ul className="mt-3 divide-y divide-hairline text-[13px]">
                {invitations.map((i) => (
                  <li key={i.id} className="flex justify-between py-2">
                    <span className="text-ink">{i.email}</span>
                    <span className="text-secondary">{i.status}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </section>
      ) : null}

      <section className="mt-5">
        <form action={signOutAction}>
          <Button type="submit" variant="outline" className="w-full" disabled={mode === "demo"}>
            {mode === "demo" ? "Sign out (not available in demo)" : "Sign out"}
          </Button>
        </form>
      </section>
    </>
  );
}

function StatusLine({ state, demo }: { state: AccountActionState; demo: boolean }) {
  if (demo) return <p className="mt-2 text-[12px] text-tertiary">Account changes require Supabase to be configured.</p>;
  if (state.status === "ok") return <p className="mt-2 text-[12px] text-green">{state.message}</p>;
  if (state.status === "error") return <p className="mt-2 text-[12px] text-red">{state.message}</p>;
  return null;
}
