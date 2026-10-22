"use client";

import { Check, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import { Wordmark } from "@/components/navigation/logo";
import { Avatar } from "@/components/ui/avatar";
import { Button, LinkButton } from "@/components/ui/primitives";
import { swipeAction, undoSwipeAction } from "@/lib/actions/swipe";
import type { SwipeCard } from "@/lib/domain/swipe";
import type { Member, VoteValue } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { CompanyProfile } from "./company-profile";

type Dir = "left" | "right";
interface Swiped {
  card: SwipeCard;
  previousVote: VoteValue | null;
}
type Overlay = { kind: "match"; card: SwipeCard } | { kind: "almost"; card: SwipeCard; likedBy: string[] } | null;

/** Distance (px) a card must be dragged to count as a swipe. */
const SWIPE_DISTANCE = 110;

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/**
 * The deck, Hinge-style: the whole screen is one company's profile, scrolled
 * like any page. ✕ (bottom left) crosses, ✓ (bottom right) ticks, swiping
 * sideways does the same, and ↺ (top right) undoes the last swipe
 * (repeatedly, newest first). The deck is local state seeded from the
 * server, so a refresh after each swipe never reshuffles it.
 */
export function SwipeDeck({ initialCards, members, currentUserId, banner }: { initialCards: SwipeCard[]; members: Member[]; currentUserId: string; banner?: ReactNode }) {
  const [deck, setDeck] = useState(initialCards);
  const [history, setHistory] = useState<Swiped[]>([]);
  const [leaving, setLeaving] = useState<{ card: SwipeCard; dir: Dir; fromX: number } | null>(null);
  const [entering, setEntering] = useState<"next" | "back" | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [error, setError] = useState<string | null>(null);
  const [dx, setDx] = useState(0);
  const [, startTransition] = useTransition();
  const pointer = useRef<{ id: number; x: number; y: number; mode: "undecided" | "h" | "v" } | null>(null);
  const suppressClick = useRef(false);
  const top = deck[0] ?? null;
  // While a profile animates away it stays on screen; the deck has already moved on.
  const shown = leaving?.card ?? top;

  const toTop = () => document.getElementById("main")?.scrollTo({ top: 0 });

  const commit = useCallback(
    (dir: Dir, fromX = 0) => {
      if (!top || leaving) return;
      const card = top;
      setError(null);
      setDeck((d) => d.filter((c) => c.company.id !== card.company.id));
      setHistory((h) => [...h, { card, previousVote: card.myVote }]);
      setLeaving({ card, dir, fromX });
      setDx(0);
      startTransition(async () => {
        const res = await swipeAction({ companyId: card.company.id, slug: card.company.slug, vote: dir === "right" ? "interested" : "pass" });
        if (!res.ok) {
          setError(res.error);
          setHistory((h) => h.filter((s) => s.card.company.id !== card.company.id));
          setDeck((d) => [card, ...d.filter((c) => c.company.id !== card.company.id)]);
          return;
        }
        const outcome = res.data!.outcome;
        if (outcome.kind === "match") setOverlay({ kind: "match", card });
        else if (outcome.kind === "almost") setOverlay({ kind: "almost", card, likedBy: outcome.likedBy });
      });
    },
    [top, leaving],
  );

  /** Undo the newest swipe, or a specific company's swipe (the almost-a-match sheet may refer to an older one). */
  const undo = useCallback((companyId?: string) => {
    const last = companyId ? history.findLast((s) => s.card.company.id === companyId) : history.at(-1);
    if (!last) return;
    setError(null);
    setOverlay(null);
    setLeaving(null);
    setHistory((h) => h.filter((s) => s !== last));
    setDeck((d) => [last.card, ...d.filter((c) => c.company.id !== last.card.company.id)]);
    setEntering("back");
    toTop();
    startTransition(async () => {
      const res = await undoSwipeAction({ companyId: last.card.company.id, slug: last.card.company.slug, previousVote: last.previousVote });
      if (!res.ok) {
        setError(res.error);
        setDeck((d) => d.filter((c) => c.company.id !== last.card.company.id));
        setHistory((h) => [...h, last]);
      }
    });
  }, [history]);

  const finishLeaving = () => {
    if (!leaving) return;
    setLeaving(null);
    setEntering("next");
    toTop();
  };

  useEffect(() => {
    if (!entering) return;
    const t = setTimeout(() => setEntering(null), 320);
    return () => clearTimeout(t);
  }, [entering]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (overlay || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowRight") commit("right");
      else if (e.key === "ArrowLeft") commit("left");
      else if ((e.key === "z" && (e.metaKey || e.ctrlKey)) || e.key === "Backspace") undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit, undo, overlay]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (leaving || (e.pointerType === "mouse" && e.button !== 0)) return;
    pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY, mode: "undecided" };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId) return;
    const mx = e.clientX - p.x;
    const my = e.clientY - p.y;
    if (p.mode === "undecided") {
      if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.2) {
        p.mode = "h";
        e.currentTarget.setPointerCapture(e.pointerId);
      } else if (Math.abs(my) > 10) p.mode = "v";
    }
    if (p.mode === "h") setDx(mx);
  };
  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = pointer.current;
    pointer.current = null;
    if (!p || p.id !== e.pointerId || p.mode !== "h") return;
    suppressClick.current = true;
    const moved = e.clientX - p.x;
    if (e.type === "pointerup" && Math.abs(moved) > SWIPE_DISTANCE) commit(moved > 0 ? "right" : "left", moved);
    else setDx(0);
  };

  const tilt = Math.max(-6, Math.min(6, dx / 40));
  const strength = Math.min(Math.abs(dx) / SWIPE_DISTANCE, 1);
  const remaining = deck.length;

  return (
    <div className="relative flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-hairline/70 bg-page/92 backdrop-blur supports-[backdrop-filter]:bg-page/80">
        <div className="mx-auto flex min-h-[56px] w-full max-w-[640px] items-center gap-3 px-4">
          <Wordmark className="min-w-0 flex-1" />
          <p className="shrink-0 whitespace-nowrap text-[13px] font-medium text-secondary" aria-live="polite">
            {remaining === 0 ? "All done" : `${remaining} to go`}
          </p>
          <button
            type="button"
            onClick={() => undo()}
            disabled={history.length === 0}
            aria-label="Undo last swipe"
            title="Undo last swipe"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline-strong bg-surface text-amber transition-transform active:scale-90 disabled:text-tertiary disabled:opacity-50"
          >
            <RotateCcw size={18} strokeWidth={2.3} />
          </button>
        </div>
      </header>

      {banner}

      {error ? (
        <p role="alert" className="px-4 py-2 text-center text-[13px] text-red">
          {error}
        </p>
      ) : null}

      {shown ? (
        <div
          key={shown.company.id}
          className={cn(
            "mx-auto w-full max-w-[640px] flex-1 touch-pan-y",
            dx !== 0 ? "select-none" : !leaving && "transition-transform duration-200 ease-out",
            entering === "back" && "animate-[card-return_300ms_ease-out]",
            entering === "next" && "animate-[profile-in_260ms_ease-out]",
          )}
          style={
            leaving
              ? ({ animation: `${leaving.dir === "right" ? "fly-right" : "fly-left"} 260ms ease-in forwards`, "--from-x": `${leaving.fromX}px`, "--from-r": `${Math.max(-6, Math.min(6, leaving.fromX / 40))}deg` } as CSSProperties)
              : dx
                ? { transform: `translateX(${dx}px) rotate(${tilt}deg)` }
                : undefined
          }
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget && leaving) finishLeaving();
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onClickCapture={(e) => {
            if (suppressClick.current) {
              suppressClick.current = false;
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          inert={leaving ? true : undefined}
        >
          <CompanyProfile card={shown} />
        </div>
      ) : (
        <CaughtUp />
      )}

      {shown && dx !== 0 ? (
        <div className="pointer-events-none fixed inset-x-0 top-28 z-30 mx-auto flex max-w-[640px] justify-between px-6" aria-hidden>
          <span className="rotate-[-12deg] rounded-[10px] border-[3px] border-green bg-surface/90 px-3 py-1 text-[22px] font-bold uppercase tracking-[0.08em] text-green" style={{ opacity: dx > 0 ? strength : 0 }}>
            Tick
          </span>
          <span className="rotate-[12deg] rounded-[10px] border-[3px] border-red bg-surface/90 px-3 py-1 text-[22px] font-bold uppercase tracking-[0.08em] text-red" style={{ opacity: dx < 0 ? strength : 0 }}>
            Cross
          </span>
        </div>
      ) : null}

      {/* Thumb-reach corners, pinned to the bottom of the screen while the profile scrolls underneath. */}
      {top ? (
        <div className="pointer-events-none sticky bottom-0 z-20 mx-auto flex w-full max-w-[640px] justify-between px-4 pb-4 pt-2">
          <button
            type="button"
            onClick={() => commit("left")}
            aria-label="Cross: not for us"
            className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-hairline-strong bg-surface text-red shadow-[var(--shadow-float)] transition-transform active:scale-90"
          >
            <X size={26} strokeWidth={2.6} />
          </button>
          <button
            type="button"
            onClick={() => commit("right")}
            aria-label="Tick: interested"
            className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-green text-white shadow-[var(--shadow-float)] transition-transform active:scale-90"
          >
            <Check size={28} strokeWidth={2.8} />
          </button>
        </div>
      ) : null}

      {overlay?.kind === "match" ? <MatchOverlay card={overlay.card} members={members} currentUserId={currentUserId} onClose={() => setOverlay(null)} /> : null}
      {overlay?.kind === "almost" ? <AlmostSheet card={overlay.card} likedBy={overlay.likedBy} onUndo={() => undo(overlay.card.company.id)} onClose={() => setOverlay(null)} /> : null}
    </div>
  );
}

function CaughtUp() {
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col items-center justify-center px-8 py-16 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-pale text-green">
        <Check size={28} strokeWidth={2.6} aria-hidden />
      </span>
      <p className="mt-4 font-serif text-[24px] font-semibold text-ink">You’re all caught up</p>
      <p className="mt-1 max-w-[30ch] text-[14px] leading-relaxed text-secondary">New companies arrive after the morning research run. Matches are waiting in your chats.</p>
      <LinkButton href="/matches" variant="outline" className="mt-5">
        See matches
      </LinkButton>
    </div>
  );
}

function MatchOverlay({ card, members, currentUserId, onClose }: { card: SwipeCard; members: Member[]; currentUserId: string; onClose: () => void }) {
  const others = members.filter((m) => m.userId !== currentUserId).map((m) => m.displayName);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="match-title" className="fixed inset-0 z-50 flex animate-[fade-in_200ms_ease-out] flex-col items-center justify-center bg-ink-deep px-8 text-center text-white">
      <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-white/60">Everyone ticked</p>
      <h2 id="match-title" className="mt-2 animate-[match-pop_420ms_cubic-bezier(.2,1.4,.4,1)] font-serif text-[44px] font-semibold leading-none">
        It’s a match!
      </h2>
      <div className="mt-7 flex -space-x-3">
        {members.map((m) => (
          <Avatar key={m.userId} member={m} size="lg" className="ring-4 ring-ink-deep" />
        ))}
      </div>
      <p className="mt-6 max-w-[30ch] text-[16px] leading-relaxed text-white/85">
        You, {joinNames(others)} all want to talk about <span className="font-semibold text-white">{card.company.name}</span>. The chat is open.
      </p>
      <Link href={`/matches/${card.company.slug}`} className="mt-8 inline-flex min-h-[50px] w-full max-w-[300px] items-center justify-center rounded-full bg-white px-6 text-[15px] font-semibold text-ink">
        Open the chat
      </Link>
      <button type="button" onClick={onClose} className="mt-3 min-h-[44px] px-6 text-[15px] font-medium text-white/80 hover:text-white">
        Keep swiping
      </button>
    </div>
  );
}

function AlmostSheet({ card, likedBy, onUndo, onClose }: { card: SwipeCard; likedBy: string[]; onUndo: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex animate-[fade-in_160ms_ease-out] items-end justify-center bg-ink/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="almost-title"
        className="w-full max-w-[480px] animate-[sheet-up_240ms_ease-out] rounded-t-[24px] bg-surface px-6 pb-[calc(24px+var(--safe-bottom))] pt-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-amber">So close</p>
        <h2 id="almost-title" className="mt-1 font-serif text-[26px] font-semibold text-ink">
          Almost a match
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-secondary">
          {joinNames(likedBy)} {likedBy.length === 2 ? "both" : "all"} ticked <span className="font-semibold text-ink">{card.company.name}</span>. Your cross was the deciding vote.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button onClick={onUndo} size="lg">
            <RotateCcw size={17} aria-hidden />
            Undo my cross
          </Button>
          <Button variant="outline" size="lg" onClick={onClose}>
            Keep my cross
          </Button>
        </div>
      </div>
    </div>
  );
}
