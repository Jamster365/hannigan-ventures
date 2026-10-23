import { Info } from "lucide-react";
import { CommentThread } from "@/components/company/comment-thread";
import { VotePanel } from "@/components/company/vote-panel";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/primitives";
import { computeFamilyStage, familyAverage, stageLabel, tallyVotes, visibleVotes } from "@/lib/domain/family-consensus";
import type { CompanyBundle, Member } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

export function FamilyTab({ bundle, members, currentUserId }: { bundle: CompanyBundle; members: Member[]; currentUserId: string }) {
  const { company, comments, assessment } = bundle;
  const stage = computeFamilyStage(bundle.votes);
  // Votes stay private until a match: before that you see only your own.
  const votes = visibleVotes(bundle.votes, currentUserId);
  const hidden = votes.length !== bundle.votes.length || stage !== "shortlisted";
  const tally = tallyVotes(votes);
  const avg = familyAverage(votes);
  const mine = votes.find((v) => v.userId === currentUserId) ?? null;
  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 font-serif text-[1.25rem] font-semibold text-ink">
            Family assessment
            <span className="text-tertiary" title="Two Interested votes = shortlisted. Two Pass votes = passed. Votes mean willingness to investigate.">
              <Info size={15} aria-hidden />
            </span>
          </h2>
          <Pill tone={stage === "shortlisted" ? "green" : stage === "passed" ? "red" : stage === "pending" ? "amber" : "neutral"}>{stageLabel(stage)}</Pill>
        </div>
        <p className="mt-1 text-[0.8125rem] text-secondary">
          {hidden ? "Each member’s vote stays private until two of you are interested." : `${tally.interested} of ${members.length} members are interested${tally.total < members.length ? ` · ${members.length - tally.total} yet to vote` : ""}`}
        </p>
        <ul className="mt-3 grid grid-cols-3 gap-2">
          {members.map((m) => {
            const v = votes.find((x) => x.userId === m.userId);
            return (
              <li key={m.userId} className="flex flex-col items-center rounded-[14px] border border-hairline bg-surface px-2 py-3 text-center">
                <Avatar member={m} size="md" />
                <p className="mt-1.5 text-[0.8125rem] font-semibold text-ink">
                  {m.displayName}
                  {m.userId === currentUserId ? <span className="font-normal text-tertiary"> (you)</span> : null}
                </p>
                {v ? (
                  <>
                    <span className={cn("mt-1 inline-flex items-center gap-1 text-[0.75rem] font-medium", v.vote === "interested" && "text-green", v.vote === "unsure" && "text-amber", v.vote === "pass" && "text-red")}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", v.vote === "interested" && "bg-green", v.vote === "unsure" && "bg-amber", v.vote === "pass" && "bg-red")} aria-hidden />
                      {v.vote === "interested" ? "Interested" : v.vote === "unsure" ? "Unsure" : "Pass"}
                    </span>
                    <span className="mt-0.5 text-[0.75rem] text-secondary tnum">{v.score !== null ? `${v.score}/10` : "No score"}</span>
                  </>
                ) : (
                  <span className="mt-1 text-[0.75rem] text-tertiary">{hidden && m.userId !== currentUserId ? "Private" : "Not reviewed"}</span>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-[14px] bg-surface-muted px-3.5 py-3">
            <p className="text-[0.75rem] text-secondary">Family average</p>
            <p className="mt-0.5 font-serif text-[1.25rem] font-semibold text-ink tnum">{avg.average !== null ? `${avg.average}/10` : "–"}</p>
            <p className="text-[0.6875rem] text-tertiary">{avg.raters ? `${avg.raters} rated` : "No scores yet"}</p>
          </div>
          <div className="rounded-[14px] bg-surface-muted px-3.5 py-3">
            <p className="text-[0.75rem] text-secondary">AI research rating</p>
            <p className="mt-0.5 font-serif text-[1.25rem] font-semibold text-ink tnum">{assessment?.aiScore != null ? `${assessment.aiScore.toFixed(1)}/10` : "Not rated"}</p>
            <p className="text-[0.6875rem] text-tertiary">Separate; never averaged in</p>
          </div>
        </div>
      </section>

      <VotePanel companyId={company.id} slug={company.slug} existing={mine} />

      <section id="discussion">
        <h2 className="font-serif text-[1.25rem] font-semibold text-ink">Family discussion</h2>
        <p className="mb-3 text-[0.75rem] text-secondary">One shared thread, visible to all members. You can edit or delete your own messages.</p>
        <CommentThread companyId={company.id} slug={company.slug} comments={comments} members={members} currentUserId={currentUserId} />
      </section>
    </div>
  );
}
