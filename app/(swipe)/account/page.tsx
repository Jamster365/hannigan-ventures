import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/navigation/page-header";
import { Card, Pill } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/current-member";
import { dataMode } from "@/lib/config";
import { getRepository } from "@/lib/data";
import { formatDate } from "@/lib/domain/format";
import { AccountForms } from "./account-forms";
import { SignInLinkButton } from "./sign-in-link";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const member = await requireMember();
  const repo = await getRepository();
  const members = await repo.getMembers();
  const mode = dataMode();
  let invitations: { id: string; email: string; status: string; expiresAt: string }[] = [];
  if (mode === "supabase" && member.role === "owner") {
    const { listInvitations } = await import("@/lib/supabase/invitations");
    invitations = await listInvitations();
  }
  return (
    <>
      <PageHeader title="Account" backHref="/me" variant="back" />
      <div className="mx-auto max-w-[720px] px-4 pt-4">
        <Card className="flex items-center gap-3 p-4">
          <Avatar member={member} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="font-serif text-[18px] font-semibold text-ink">{member.displayName}</p>
            <p className="truncate text-[13px] text-secondary">{member.email ?? (mode === "demo" ? "Sample member — no email" : "")}</p>
          </div>
          <Pill tone={member.role === "owner" ? "blue" : "neutral"}>{member.role === "owner" ? "Owner" : "Member"}</Pill>
        </Card>
        <AccountForms mode={mode} member={member} invitations={invitations} />
        <section className="mt-6">
          <h2 className="mb-2 font-serif text-[18px] font-semibold text-ink">Household members</h2>
          <Card className="overflow-hidden p-0">
            {mode === "supabase" && member.role === "owner" ? <p className="border-b border-hairline px-4 py-2.5 text-[12px] text-secondary">If someone’s sign-in email doesn’t arrive (BT and some other mail providers can hold it back), make them a sign-in link here and send it to them directly.</p> : null}
            <ul className="divide-y divide-hairline">
              {members.map((m) => (
                <li key={m.userId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Avatar member={m} size="sm" />
                  <span className="flex-1 text-[14px] font-medium text-ink">{m.displayName}</span>
                  <span className="text-[12px] text-tertiary">Joined {formatDate(m.joinedAt)}</span>
                  {mode === "supabase" && member.role === "owner" && m.userId !== member.userId ? <SignInLinkButton userId={m.userId} name={m.displayName} /> : null}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      </div>
    </>
  );
}
