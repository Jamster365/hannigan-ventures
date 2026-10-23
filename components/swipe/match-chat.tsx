"use client";

import { ArrowUp, Sparkles } from "lucide-react";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useLiveRefresh } from "@/components/live/use-live-refresh";
import { Avatar } from "@/components/ui/avatar";
import { addCommentAction, deleteCommentAction, editCommentAction } from "@/lib/actions/family";
import { markMatchReadAction } from "@/lib/actions/swipe";
import { formatDateTime } from "@/lib/domain/format";
import { RESEARCH_AUTHOR_ID, type Comment, type Member } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * The match chat: the company's one shared comment thread, shown as chat
 * bubbles, with the Research AI member posting company updates. Opening it
 * clears the match's unread notifications; with `live`, new messages appear
 * as they are sent.
 */
export function MatchChat({ companyId, slug, companyName, comments, members, currentUserId, unreadIds, intro, live }: { companyId: string; slug: string; companyName: string; comments: Comment[]; members: Member[]; currentUserId: string; unreadIds: string[]; intro: string; live: boolean }) {
  useLiveRefresh({ enabled: live, channel: `chat:${companyId}`, table: "comments", filter: `company_id=eq.${companyId}` });
  const [pending, start] = useTransition();
  const [optimistic, addOptimistic] = useOptimistic(comments, (state: Comment[], next: Comment) => [...state, next]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const visible = optimistic.filter((c) => !c.deletedAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const unreadKey = unreadIds.join(",");

  useEffect(() => {
    if (unreadKey) void markMatchReadAction(unreadKey.split(","));
  }, [unreadKey]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [visible.length]);

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    start(async () => {
      addOptimistic({ id: `tmp-${Date.now()}`, companyId, authorUserId: currentUserId, body, createdAt: new Date().toISOString(), editedAt: null, deletedAt: null });
      const res = await addCommentAction({ companyId, slug, body });
      if (!res.ok) {
        setError(res.error);
        setDraft(body);
      } else setError(null);
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-label={`Chat about ${companyName}`}>
        <p className="mx-auto mb-4 max-w-[34ch] rounded-full bg-green-pale px-4 py-1.5 text-center text-[0.75rem] font-medium text-green">{intro}</p>
        <ol className="mx-auto max-w-[760px] space-y-1.5">
          {visible.map((c, i) => {
            const mine = c.authorUserId === currentUserId;
            const research = c.authorUserId === RESEARCH_AUTHOR_ID;
            const author = members.find((m) => m.userId === c.authorUserId);
            const firstOfRun = i === 0 || visible[i - 1].authorUserId !== c.authorUserId;
            return (
              <li key={c.id} className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start", firstOfRun && i > 0 && "pt-2")}>
                {!mine ? <span className="w-8 shrink-0">{firstOfRun ? research ? <ResearchAvatar /> : author ? <Avatar member={author} size="sm" /> : null : null}</span> : null}
                <div className={cn("max-w-[78%]", mine && "flex flex-col items-end")}>
                  {!mine && firstOfRun ? <p className="mb-0.5 ml-3 text-[0.6875rem] font-medium text-tertiary">{research ? "Research · AI" : (author?.displayName ?? "Member")}</p> : null}
                  <Bubble comment={c} mine={mine} research={research} slug={slug} selected={selected === c.id} onSelect={() => setSelected(selected === c.id ? null : c.id)} />
                </div>
              </li>
            );
          })}
        </ol>
        <div ref={bottom} />
      </div>

      {error ? (
        <p role="alert" className="px-4 pb-1 text-[0.8125rem] text-red">
          {error}
        </p>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex shrink-0 items-end gap-2 border-t border-hairline bg-surface px-3 py-2 md:px-[max(12px,calc((100%-760px)/2))]"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Message"
          aria-label="Message"
          className="max-h-32 min-h-[42px] flex-1 resize-none rounded-[21px] border border-hairline-strong bg-page px-4 py-2.5 text-[0.9375rem] text-ink placeholder:text-tertiary focus:outline-none"
        />
        <button type="submit" disabled={pending || !draft.trim()} aria-label="Send" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-white disabled:opacity-40">
          <ArrowUp size={20} strokeWidth={2.4} />
        </button>
      </form>
    </div>
  );
}

function ResearchAvatar() {
  return (
    <span role="img" aria-label="Research (AI)" title="Research (AI)" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-pale text-violet">
      <Sparkles size={15} aria-hidden />
    </span>
  );
}

function Bubble({ comment, mine, research, slug, selected, onSelect }: { comment: Comment; mine: boolean; research: boolean; slug: string; selected: boolean; onSelect: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.body);
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState<string | null>(null);
  const temp = comment.id.startsWith("tmp-");

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await editCommentAction({ commentId: comment.id, slug, body: text });
            if (res.ok) {
              setEditing(false);
              setFailed(null);
            } else setFailed(res.error);
          });
        }}
        className="w-[min(78vw,360px)]"
      >
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} className="w-full rounded-[16px] border border-hairline-strong px-3 py-2 text-[0.9375rem] text-ink" aria-label="Edit message" />
        {failed ? (
          <p role="alert" className="mt-1 text-right text-[0.75rem] text-red">
            {failed}
          </p>
        ) : null}
        <div className="mt-1 flex justify-end gap-3 text-[0.8125rem]">
          <button type="button" onClick={() => { setEditing(false); setText(comment.body); setFailed(null); }} className="text-secondary">
            Cancel
          </button>
          <button type="submit" disabled={pending} className="font-semibold text-blue">
            Save
          </button>
        </div>
      </form>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "whitespace-pre-wrap break-words rounded-[20px] px-3.5 py-2 text-left text-[0.9375rem] leading-snug",
          mine ? "rounded-br-[6px] bg-ink text-white" : research ? "rounded-bl-[6px] border border-violet/20 bg-violet-pale text-ink" : "rounded-bl-[6px] bg-surface-muted text-ink",
          temp && "opacity-60",
        )}
      >
        {research && comment.body.includes("\n") && !comment.body.startsWith("I'm Research") ? (
          <>
            <span className="font-semibold">{comment.body.slice(0, comment.body.indexOf("\n"))}</span>
            {comment.body.slice(comment.body.indexOf("\n"))}
          </>
        ) : (
          comment.body
        )}
      </button>
      {selected ? (
        <p className={cn("mt-0.5 flex gap-3 px-2 text-[0.6875rem] text-tertiary", mine ? "justify-end" : "justify-start")}>
          <span>
            {formatDateTime(comment.createdAt)}
            {comment.editedAt ? " · edited" : ""}
          </span>
          {mine && !temp ? (
            <>
              <button type="button" onClick={() => setEditing(true)} className="font-medium text-secondary hover:text-ink">
                Edit
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (confirm("Delete this message?"))
                    start(async () => {
                      const res = await deleteCommentAction({ commentId: comment.id, slug });
                      setFailed(res.ok ? null : res.error);
                    });
                }}
                className="font-medium text-secondary hover:text-red"
              >
                Delete
              </button>
            </>
          ) : null}
        </p>
      ) : null}
      {failed ? (
        <p role="alert" className={cn("mt-0.5 px-2 text-[0.6875rem] text-red", mine ? "text-right" : "text-left")}>
          {failed}
        </p>
      ) : null}
    </>
  );
}
