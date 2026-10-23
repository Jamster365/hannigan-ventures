"use client";

import { SendHorizontal } from "lucide-react";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { addCommentAction, deleteCommentAction, editCommentAction } from "@/lib/actions/family";
import { relativeTime } from "@/lib/domain/format";
import { RESEARCH_AUTHOR_ID, type Comment, type Member } from "@/lib/domain/types";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** One shared, flat, chronological thread per company. Newest last. */
export function CommentThread({ companyId, slug, comments, members, currentUserId }: { companyId: string; slug: string; comments: Comment[]; members: Member[]; currentUserId: string }) {
  const [pending, start] = useTransition();
  const [optimistic, addOptimistic] = useOptimistic(comments, (state: Comment[], next: Comment) => [...state, next]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const me = members.find((m) => m.userId === currentUserId);
  const visible = optimistic.filter((c) => !c.deletedAt);

  const submit = () => {
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
    <div>
      {visible.length === 0 ? (
        <p className="rounded-[14px] bg-surface-muted px-4 py-5 text-center text-[13px] text-secondary">No discussion yet. Share a view or a question for the others.</p>
      ) : (
        <ol className="space-y-3">
          {visible.map((c) => (
            <CommentItem key={c.id} comment={c} author={members.find((m) => m.userId === c.authorUserId)} mine={c.authorUserId === currentUserId} slug={slug} />
          ))}
        </ol>
      )}
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="sticky bottom-[calc(var(--bottom-nav-height)+var(--safe-bottom)+8px)] mt-4 flex items-end gap-2 rounded-[18px] border border-hairline bg-surface p-1.5 shadow-[var(--shadow-card)] xl:bottom-4"
      >
        {me ? <Avatar member={me} size="sm" className="mb-1 ml-1" /> : null}
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          rows={1}
          maxLength={2000}
          placeholder="Add a comment…"
          aria-label="Add a comment"
          className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] text-ink placeholder:text-tertiary focus:outline-none"
        />
        <button type="submit" disabled={pending || !draft.trim()} aria-label="Post comment" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-white disabled:opacity-40">
          <SendHorizontal size={17} />
        </button>
      </form>
      {error ? (
        <p role="alert" className="mt-2 text-[13px] text-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function CommentItem({ comment, author, mine, slug }: { comment: Comment; author: Member | undefined; mine: boolean; slug: string }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.body);
  const [pending, start] = useTransition();
  return (
    <li className="flex gap-3">
      {author ? <Avatar member={author} size="sm" className="mt-0.5" /> : <span className="h-8 w-8 shrink-0 rounded-full bg-violet-pale" />}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[14px] font-semibold text-ink">{comment.authorUserId === RESEARCH_AUTHOR_ID ? "Research (AI)" : (author?.displayName ?? "Member")}</span>
          <span className="text-[11px] text-tertiary">{relativeTime(comment.createdAt)}</span>
          {comment.editedAt ? <span className="text-[11px] text-tertiary">(edited)</span> : null}
        </div>
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await editCommentAction({ commentId: comment.id, slug, body: text });
                if (res.ok) setEditing(false);
              });
            }}
            className="mt-1"
          >
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} className="w-full rounded-[12px] border border-hairline-strong px-3 py-2 text-[14px] text-ink" aria-label="Edit comment" />
            <div className="mt-1 flex gap-2 text-[12px]">
              <button type="submit" disabled={pending} className="font-medium text-blue">
                Save
              </button>
              <button type="button" onClick={() => { setEditing(false); setText(comment.body); }} className="text-secondary">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <p className={cn("mt-0.5 whitespace-pre-wrap text-[14px] leading-relaxed text-text", comment.id.startsWith("tmp-") && "opacity-60")}>{comment.body}</p>
        )}
        {mine && !editing && !comment.id.startsWith("tmp-") ? (
          <div className="mt-1 flex gap-3 text-[12px]">
            <button type="button" onClick={() => setEditing(true)} className="text-secondary hover:text-ink">
              Edit
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (confirm("Delete this comment?")) start(async () => { await deleteCommentAction({ commentId: comment.id, slug }); });
              }}
              className="text-secondary hover:text-red"
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
}
