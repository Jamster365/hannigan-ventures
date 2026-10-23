import { ExternalLink, MapPin } from "lucide-react";
import { Card, Pill, type Tone } from "@/components/ui/primitives";
import { formatDate, formatDateTime } from "@/lib/domain/format";
import type { EventRecord } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const accessMeta: Record<EventRecord["accessStatus"], { label: string; tone: Tone }> = {
  open: { label: "Registration open", tone: "green" },
  waitlist: { label: "Waitlist", tone: "amber" },
  invitation_only: { label: "Invitation only", tone: "neutral" },
  closed: { label: "Registration closed", tone: "red" },
  unknown: { label: "Registration status unknown", tone: "neutral" },
};

function DateBlock({ iso }: { iso: string }) {
  const d = new Date(iso);
  const month = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "Europe/London" }).format(d).toUpperCase();
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "Europe/London" }).format(d);
  return (
    <div className="flex h-[52px] w-[52px] shrink-0 flex-col items-center justify-center rounded-[12px] bg-red-pale text-red">
      <span className="text-[0.625rem] font-semibold leading-none">{month}</span>
      <span className="mt-0.5 font-serif text-[1.25rem] font-semibold leading-none tnum">{day}</span>
    </div>
  );
}

export function EventCard({ event, compact, currentUserId }: { event: EventRecord; compact?: boolean; currentUserId?: string }) {
  const a = accessMeta[event.accessStatus];
  const mine = currentUserId ? event.memberStatus?.[currentUserId] : undefined;
  return (
    <Card as="article" className={cn("flex gap-3", compact ? "p-3" : "p-4")}>
      <DateBlock iso={event.startAt} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className={cn("font-semibold leading-tight text-ink", compact ? "text-[0.875rem]" : "font-serif text-[1.0625rem]")}>{event.name}</h3>
            <p className="mt-0.5 truncate text-[0.75rem] text-secondary">
              {event.organiser} · {event.eventType}
            </p>
          </div>
          {mine === "registered" ? <Pill tone="green">Registered</Pill> : <Pill tone={a.tone}>{a.label}</Pill>}
        </div>
        {!compact ? (
          <>
            <p className="mt-2 flex items-center gap-1.5 text-[0.8125rem] text-secondary">
              <MapPin size={13} aria-hidden />
              {event.isOnline ? "Online" : [event.venue, event.city].filter(Boolean).join(", ")} · {formatDateTime(event.startAt)} (London)
            </p>
            <p className="mt-2 text-[0.8125rem] text-text">{event.significance}</p>
            <p className="mt-1 text-[0.75rem] text-secondary">
              <span className="font-medium text-ink">Next:</span> {event.nextAction}
            </p>
            <p className="mt-1 text-[0.6875rem] text-tertiary">{event.registrationCheckedAt ? `Status checked ${formatDate(event.registrationCheckedAt)}` : "Registration status not verified"}</p>
            {event.registrationUrl ? (
              <a href={event.registrationUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-[36px] items-center gap-1 text-[0.8125rem] font-medium text-blue">
                Registration page <ExternalLink size={13} aria-hidden />
              </a>
            ) : null}
          </>
        ) : null}
      </div>
    </Card>
  );
}
