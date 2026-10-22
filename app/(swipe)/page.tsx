import { Hourglass, PartyPopper } from "lucide-react";
import Link from "next/link";
import { Wordmark } from "@/components/navigation/logo";
import { SwipeDeck } from "@/components/swipe/swipe-deck";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import { buildSwipeCard, deckFor, waitingOnMe } from "@/lib/domain/swipe";

export const metadata = { title: "Discover" };

export default async function DiscoverDeckPage() {
  const member = await requireMember();
  const repo = await getRepository();
  const [members, bundles, notifications, prompt] = await Promise.all([repo.getMembers(), repo.listCompanies(), repo.listNotifications(member.userId), repo.getActivePrompt()]);
  const now = new Date();
  const deck = deckFor(bundles, member.userId);
  const cards = deck.map((b) => buildSwipeCard(b, member.userId, { now, maxChequeGbp: prompt.config.maxChequeGbp }));
  const waiting = waitingOnMe(deck, members, member.userId);
  const newMatch = notifications.find((n) => !n.readAt && n.notificationType === "shortlist_promoted" && n.href.startsWith("/matches"));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-[480px] shrink-0 items-center justify-between gap-3 px-4 pb-2 pt-3">
        <Wordmark />
        <p className="shrink-0 whitespace-nowrap text-[13px] font-medium text-secondary" aria-live="polite">
          {cards.length === 0 ? "Nothing to review" : `${cards.length} to review`}
        </p>
      </header>

      {newMatch ? (
        <Link href={newMatch.href} className="mx-auto mb-2 flex w-[calc(100%-24px)] max-w-[456px] shrink-0 items-center gap-2.5 rounded-[14px] bg-ink px-3.5 py-2.5 text-[13px] text-white">
          <PartyPopper size={17} className="shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{newMatch.title}</span>
          <span className="shrink-0 font-semibold">Open chat</span>
        </Link>
      ) : waiting > 0 ? (
        <p className="mx-auto mb-2 flex w-[calc(100%-24px)] max-w-[456px] shrink-0 items-center gap-2 rounded-[14px] bg-amber-pale px-3.5 py-2.5 text-[13px] text-amber" role="status">
          <Hourglass size={16} className="shrink-0" aria-hidden />
          {waiting === 1 ? "1 company in your deck is waiting on your swipe." : `${waiting} companies in your deck are waiting on your swipe.`}
        </p>
      ) : null}

      <SwipeDeck key={member.userId} initialCards={cards} members={members} currentUserId={member.userId} />
    </div>
  );
}
