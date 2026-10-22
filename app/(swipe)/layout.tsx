import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DemoBanner } from "@/components/navigation/demo-banner";
import { LaunchSplash } from "@/components/navigation/launch-splash";
import { WarmLinks } from "@/components/navigation/warm-links";
import { SwipeNav } from "@/components/swipe/swipe-nav";
import { getCurrentMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * The swipe app: Discover (tick or cross), Matches (one chat per match) and
 * Me. The classic app lives in app/(classic) and is reachable at /home.
 */
export default async function SwipeLayout({ children }: { children: ReactNode }) {
  const member = await getCurrentMember();
  if (!member) redirect("/auth/sign-in");
  const repo = await getRepository();
  const [members, notifications] = await Promise.all([repo.getMembers(), repo.listNotifications(member.userId)]);
  const unreadMatches = notifications.filter((n) => !n.readAt && (n.notificationType === "shortlist_promoted" || n.notificationType === "comment") && n.href.startsWith("/matches")).length;

  return (
    // A fixed-height shell: pages scroll inside <main>, so the swipe deck and
    // the chat composer can fill exactly the space above the tab bar.
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      <LaunchSplash />
      <WarmLinks />
      {repo.mode === "demo" ? <DemoBanner members={members} current={member} /> : null}
      <main id="main" className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        {children}
      </main>
      <SwipeNav unreadMatches={unreadMatches} />
    </div>
  );
}
