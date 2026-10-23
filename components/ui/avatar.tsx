import type { Member } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const accentClasses: Record<Member["accent"], string> = {
  blue: "bg-blue-pale text-blue",
  green: "bg-green-pale text-green",
  red: "bg-red-pale text-red",
  violet: "bg-violet-pale text-violet",
  amber: "bg-amber-pale text-amber",
};

export function Avatar({ member, size = "md", className, ring }: { member: Pick<Member, "initial" | "accent" | "displayName">; size?: "xs" | "sm" | "md" | "lg"; className?: string; ring?: boolean }) {
  const dims = size === "xs" ? "h-6 w-6 text-[11px]" : size === "sm" ? "h-8 w-8 text-[13px]" : size === "lg" ? "h-14 w-14 text-[22px]" : "h-10 w-10 text-[16px]";
  return (
    <span
      role="img"
      aria-label={member.displayName}
      title={member.displayName}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-serif font-semibold", dims, accentClasses[member.accent], ring && "ring-2 ring-surface", className)}
    >
      {member.initial}
    </span>
  );
}

/**
 * Three-avatar consensus strip: muted for members who have not voted. With
 * `hidden` (no match yet) only the viewer's own vote shows; the others are
 * drawn neutrally, so withholding a vote never looks like "not reviewed".
 */
export function ConsensusStrip({ members, votes, size = "xs", hidden = false }: { members: Member[]; votes: { userId: string; vote: "interested" | "unsure" | "pass" }[]; size?: "xs" | "sm"; hidden?: boolean }) {
  return (
    <span className="inline-flex -space-x-1.5" aria-label={hidden ? "Votes are private until a match" : "Family votes"}>
      {members.map((m) => {
        const v = votes.find((x) => x.userId === m.userId);
        return (
          <span key={m.userId} className="relative inline-flex" title={`${m.displayName}: ${v ? v.vote : hidden ? "private until a match" : "not reviewed"}`}>
            <Avatar member={m} size={size} ring className={cn(!v && !hidden && "opacity-40 grayscale")} />
            {v ? (
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface",
                  v.vote === "interested" && "bg-green",
                  v.vote === "unsure" && "bg-amber",
                  v.vote === "pass" && "bg-red",
                )}
                aria-hidden
              />
            ) : null}
          </span>
        );
      })}
    </span>
  );
}
