import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { DemoBanner } from "@/components/navigation/demo-banner";
import { Sidebar } from "@/components/navigation/sidebar";
import { getCurrentMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import { formatDateTime } from "@/lib/domain/format";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const member = await getCurrentMember();
  if (!member) redirect("/auth/sign-in");
  const repo = await getRepository();
  const [members, notifications, runs] = await Promise.all([repo.getMembers(), repo.listNotifications(member.userId), repo.listRuns()]);
  const unread = notifications.filter((n) => !n.readAt).length;
  const lastRun = runs[0];
  const lastRunLabel = lastRun ? `${lastRun.status === "published" ? "Published" : lastRun.status.replace("_", " ")} · ${formatDateTime(lastRun.finishedAt ?? lastRun.startedAt)}` : null;

  return (
    <div className="flex min-h-dvh w-full">
      <Sidebar unread={unread} lastRunLabel={lastRunLabel} />
      <div className="flex min-w-0 flex-1 flex-col">
        {repo.mode === "demo" ? <DemoBanner members={members} current={member} /> : null}
        <main id="main" className="flex-1 pb-[calc(var(--bottom-nav-height)+var(--safe-bottom)+24px)] xl:pb-10">
          {children}
        </main>
      </div>
      <BottomNav unread={unread} />
    </div>
  );
}
