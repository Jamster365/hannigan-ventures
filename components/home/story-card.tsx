import { CalendarClock, CircleCheck, Coins, FlaskConical, Radar, Users } from "lucide-react";
import Link from "next/link";
import { CompanyArtwork } from "@/components/company/company-artwork";
import { Card, Pill, type Tone } from "@/components/ui/primitives";
import { relativeTime } from "@/lib/domain/format";
import type { CompanySummary } from "@/lib/domain/summaries";
import type { HomeStory, StoryType } from "@/lib/domain/types";

const meta: Record<StoryType, { label: string; tone: Tone; icon: typeof Coins }> = {
  financing: { label: "Funding update", tone: "green", icon: Coins },
  access: { label: "Access verified", tone: "green", icon: CircleCheck },
  deadline: { label: "Deadline", tone: "amber", icon: CalendarClock },
  signal: { label: "Signal", tone: "blue", icon: Radar },
  research: { label: "New research", tone: "violet", icon: FlaskConical },
  family: { label: "Family", tone: "amber", icon: Users },
};

export function StoryCard({ story, company }: { story: HomeStory; company: CompanySummary | null }) {
  const m = meta[story.storyType];
  const Icon = m.icon;
  const href = company ? `/companies/${company.company.slug}${story.storyType === "financing" || story.storyType === "access" ? "?tab=funding" : story.storyType === "research" ? "?tab=updates" : ""}` : "/updates";
  return (
    <Card as="article" className="relative flex h-full overflow-hidden">
      <Link href={href} className="absolute inset-0 z-[1] rounded-[inherit]" aria-label={story.headline} />
      <div className="flex min-w-0 flex-1 flex-col p-3.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface-muted text-secondary">
            <Icon size={14} aria-hidden />
          </span>
          <Pill tone={m.tone} className="uppercase tracking-[0.06em] text-[10px] font-semibold">
            {m.label}
          </Pill>
          <span className="ml-auto text-[11px] text-tertiary">{relativeTime(story.createdAt)}</span>
        </div>
        <h3 className="mt-2.5 font-serif text-[16px] font-semibold leading-snug text-ink clamp-2">{story.headline}</h3>
        <p className="mt-1 text-[13px] leading-snug text-secondary clamp-2">{story.teaser}</p>
      </div>
      {company ? (
        <div className="w-[88px] shrink-0 bg-ink">
          <CompanyArtwork company={company.company} media={company.primaryMedia} logo={company.logoMedia} variant="thumb" />
        </div>
      ) : null}
    </Card>
  );
}
