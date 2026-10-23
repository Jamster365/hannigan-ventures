import { SwipeDeck } from "@/components/swipe/swipe-deck";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import { buildSwipeCard, deckFor } from "@/lib/domain/swipe";

export const metadata = { title: "Discover" };

/** `?c=<slug>` brings that company to the top of the deck (links from elsewhere in the app). */
export default async function DiscoverDeckPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c: focus } = await searchParams;
  const member = await requireMember();
  const repo = await getRepository();
  const [members, bundles, notifications, prompt] = await Promise.all([repo.getMembers(), repo.listCompanies(), repo.listNotifications(member.userId), repo.getActivePrompt()]);
  const now = new Date();
  const deck = deckFor(bundles, member.userId, { now, maxChequeGbp: prompt.config.maxChequeGbp, memberCount: members.length });
  const at = focus ? deck.findIndex((b) => b.company.slug === focus) : -1;
  if (at > 0) deck.unshift(...deck.splice(at, 1));
  const cards = deck.map((b) => buildSwipeCard(b, member.userId, { now, maxChequeGbp: prompt.config.maxChequeGbp }));
  const newMatch = notifications.find((n) => !n.readAt && n.notificationType === "shortlist_promoted" && n.href.startsWith("/matches"));

  const banner = newMatch ? ({ kind: "match", href: newMatch.href, title: newMatch.title } as const) : null;

  return <SwipeDeck key={member.userId} initialCards={cards} members={members} banner={banner} />;
}
