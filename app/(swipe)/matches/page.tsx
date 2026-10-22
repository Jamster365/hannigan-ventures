import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { CompanyArtwork } from "@/components/company/company-artwork";
import { PageHeader } from "@/components/navigation/page-header";
import { EmptyState } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import { relativeTime } from "@/lib/domain/format";
import { matchesFor } from "@/lib/domain/swipe";
import { cn } from "@/lib/utils";

export const metadata = { title: "Matches" };

export default async function MatchesPage() {
  const member = await requireMember();
  const repo = await getRepository();
  const [members, bundles, notifications] = await Promise.all([repo.getMembers(), repo.listCompanies(), repo.listNotifications(member.userId)]);
  const rows = matchesFor(bundles, members, notifications);
  const nameOf = (id: string) => (id === member.userId ? "You" : (members.find((m) => m.userId === id)?.displayName ?? "Member"));

  return (
    <>
      <PageHeader title="Matches" />
      <div className="mx-auto w-full max-w-[640px] pb-6">
        {rows.length === 0 ? (
          <div className="pt-8">
            <EmptyState
              icon={<MessageCircle size={28} />}
              title="No matches yet"
              body="When all three of you tick the same company, it lands here with its own chat."
            />
          </div>
        ) : (
          <ul className="divide-y divide-hairline">
            {rows.map((r) => (
              <li key={r.company.id}>
                <Link href={`/matches/${r.company.slug}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted/60">
                  <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-hairline">
                    <CompanyArtwork company={r.company} media={r.media} logo={r.logo} variant="thumb" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate text-[16px] text-ink", r.unread || r.isNewMatch ? "font-bold" : "font-semibold")}>{r.company.name}</span>
                      <span className="shrink-0 text-[12px] text-tertiary">{relativeTime(r.lastMessage?.createdAt ?? r.matchedAt)}</span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className={cn("truncate text-[14px]", r.unread ? "font-medium text-ink" : "text-secondary")}>
                        {r.lastMessage ? `${nameOf(r.lastMessage.authorUserId)}: ${r.lastMessage.body}` : r.isNewMatch ? "New match! Say hello." : "Matched. No messages yet."}
                      </span>
                      {r.unread ? (
                        <span className="shrink-0 rounded-full bg-red px-1.5 text-[11px] font-semibold leading-[18px] text-white">{r.unread}</span>
                      ) : r.isNewMatch ? (
                        <span className="shrink-0 rounded-full bg-green px-2 text-[11px] font-semibold leading-[18px] text-white">New</span>
                      ) : null}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
