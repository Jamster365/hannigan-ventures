"use client";

import { Check, MessageSquarePlus, PartyPopper, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useTransition, type CSSProperties } from "react";
import { Wordmark } from "@/components/navigation/logo";
import { Avatar } from "@/components/ui/avatar";
import { Button, LinkButton } from "@/components/ui/primitives";
import { saveReasonAction, swipeAction, undoSwipeAction } from "@/lib/actions/swipe";
import type { SwipeCard } from "@/lib/domain/swipe";
import type { Member, VoteValue } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { CompanyProfile } from "./company-profile";

type Dir = "left" | "right";
interface Swiped {
  card: SwipeCard;
  previousVote: VoteValue | null;
}
type Overlay = { kind: "match"; card: SwipeCard; tickedBy: string[] } | { kind: "almost"; card: SwipeCard } | null;

const TIP_KEY = "hv-deck-tip-seen";

/** A line above the deck when a new match is waiting to be opened. */
export type DeckBanner = { kind: "match"; href: string; title: string } | null;

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/**
 * The deck, Hinge-style: the whole screen is one company's profile, scrolled
 * like any page. Round Interested / Not interested buttons float in the
 * bottom corners and Undo sits in the header. There is no drag-to-swipe.
 * Undo here covers this visit; Profile → Your picks changes any earlier vote.
 * The deck is local state seeded from the server, so a refresh after each
 * swipe never reshuffles it.
 */
export function SwipeDeck({ initialCards, members, banner }: { initialCards: SwipeCard[]; members: Member[]; banner: DeckBanner }) {
  const [deck, setDeck] = useState(initialCards);
  const [history, setHistory] = useState<Swiped[]>([]);
  const [leaving, setLeaving] = useState<{ card: SwipeCard; dir: Dir; fromX: number } | null>(null);
  const [entering, setEntering] = useState<"next" | "back" | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<{ card: SwipeCard; vote: "interested" | "pass" } | null>(null);
  const [tip, setTip] = useState(false);
  const [, startTransition] = useTransition();
  const top = deck[0] ?? null;

  const toTop = () => document.getElementById("main")?.scrollTo({ top: 0 });

  const commit = useCallback(
    (dir: Dir, fromX = 0) => {
      if (!top || leaving) return;
      const card = top;
      setError(null);
      setDeck((d) => d.filter((c) => c.company.id !== card.company.id));
      setHistory((h) => [...h, { card, previousVote: card.myVote }]);
      setLeaving({ card, dir, fromX });
      setReasonFor(null);
      startTransition(async () => {
        const res = await swipeAction({ companyId: card.company.id, slug: card.company.slug, vote: dir === "right" ? "interested" : "pass" });
        if (!res.ok) {
          setError(res.error);
          setHistory((h) => h.filter((s) => s.card.company.id !== card.company.id));
          setDeck((d) => [card, ...d.filter((c) => c.company.id !== card.company.id)]);
          return;
        }
        const outcome = res.data!.outcome;
        if (outcome.kind === "match") setOverlay({ kind: "match", card, tickedBy: outcome.tickedBy });
        else if (outcome.kind === "almost") setOverlay({ kind: "almost", card });
        else setReasonFor({ card, vote: dir === "right" ? "interested" : "pass" });
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
    setReasonFor(null);
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

  // One-time tip on the very first visit to a non-empty deck.
  useEffect(() => {
    if (!initialCards.length) return;
    let seen = true;
    try {
      seen = Boolean(localStorage.getItem(TIP_KEY));
    } catch {
      // Storage blocked: skip the tip rather than show it every time.
    }
    if (seen) return;
    const t = setTimeout(() => setTip(true), 0);
    return () => clearTimeout(t);
  }, [initialCards.length]);

  const closeTip = () => {
    setTip(false);
    try {
      localStorage.setItem(TIP_KEY, "1");
    } catch {
      // Ignore: the tip may show again next time.
    }
  };

  const finishLeaving = useCallback(() => {
    setLeaving((l) => {
      if (!l) return l;
      setEntering("next");
      toTop();
      return null;
    });
  }, []);

  // The fly-out animation normally ends itself; if a re-render ever swallows
  // the event, this clears it anyway so the deck can never stick or go blank.
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(finishLeaving, 320);
    return () => clearTimeout(t);
  }, [leaving, finishLeaving]);

  useEffect(() => {
    if (!entering) return;
    const t = setTimeout(() => setEntering(null), 320);
    return () => clearTimeout(t);
  }, [entering]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (overlay || tip || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowRight") commit("right");
      else if (e.key === "ArrowLeft") commit("left");
      else if ((e.key === "z" && (e.metaKey || e.ctrlKey)) || e.key === "Backspace") undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit, undo, overlay, tip]);

  const remaining = deck.length;

  return (
    <div className="relative flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-hairline/70 bg-page/92 backdrop-blur supports-[backdrop-filter]:bg-page/80">
        <div className="mx-auto flex min-h-[56px] w-full max-w-[640px] items-center gap-3 px-4">
          <Wordmark className="min-w-0 flex-1" />
          <p className="shrink-0 whitespace-nowrap text-[0.8125rem] font-medium text-secondary" aria-live="polite">
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

      {banner?.kind === "match" ? (
        <Link href={banner.href} className="mx-auto mt-2 flex w-[calc(100%-32px)] max-w-[608px] items-center gap-2.5 rounded-[14px] bg-ink px-3.5 py-2.5 text-[0.8125rem] text-white">
          <PartyPopper size={17} className="shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{banner.title}</span>
          <span className="shrink-0 font-semibold">Open chat</span>
        </Link>
      ) : null}

      {error ? (
        <p role="alert" className="px-4 py-2 text-center text-[0.8125rem] text-red">
          {error}
        </p>
      ) : null}

      {/* The answered profile flies out on its own layer while the next one is already in place underneath. */}
      {leaving ? (
        <div
          key={`leaving-${leaving.card.company.id}`}
          className="pointer-events-none absolute inset-x-0 top-14 z-20 mx-auto w-full max-w-[640px]"
          style={{ animation: `${leaving.dir === "right" ? "fly-right" : "fly-left"} 260ms ease-in forwards`, "--from-x": `${leaving.fromX}px`, "--from-r": `${Math.max(-6, Math.min(6, leaving.fromX / 40))}deg` } as CSSProperties}
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget) finishLeaving();
          }}
          inert
          aria-hidden
        >
          <CompanyProfile card={leaving.card} />
        </div>
      ) : null}
      {top ? (
        <div key={top.company.id} className={cn("mx-auto w-full max-w-[640px] flex-1", entering === "back" && "animate-[card-return_300ms_ease-out]", entering === "next" && "animate-[profile-in_260ms_ease-out]")}>
          <CompanyProfile card={top} />
        </div>
      ) : (
        <CaughtUp />
      )}

      {reasonFor && !overlay ? <ReasonPrompt key={reasonFor.card.company.id} card={reasonFor.card} vote={reasonFor.vote} onDone={() => setReasonFor(null)} /> : null}

      {/* Thumb-reach corners, pinned to the bottom of the screen while the profile scrolls underneath. */}
      {top ? (
        <div className="pointer-events-none sticky bottom-0 z-20 mx-auto flex w-full max-w-[640px] justify-between px-4 pb-4 pt-2 md:max-w-[800px] md:px-3">
          <button
            type="button"
            onClick={() => commit("left")}
            aria-label="Not interested"
            title="Not interested"
            className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-hairline-strong bg-surface text-red shadow-[var(--shadow-float)] transition-transform active:scale-90"
          >
            <X size={26} strokeWidth={2.6} />
          </button>
          <button
            type="button"
            onClick={() => commit("right")}
            aria-label="Interested"
            title="Interested"
            className="pointer-events-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-green text-white shadow-[var(--shadow-float)] transition-transform active:scale-90"
          >
            <Check size={28} strokeWidth={2.8} />
          </button>
        </div>
      ) : null}

      {tip && top ? <DeckTip onClose={closeTip} /> : null}
      {overlay?.kind === "match" ? <MatchOverlay card={overlay.card} members={members} tickedBy={overlay.tickedBy} onClose={() => setOverlay(null)} /> : null}
      {overlay?.kind === "almost" ? <AlmostSheet card={overlay.card} onUndo={() => undo(overlay.card.company.id)} onClose={() => setOverlay(null)} /> : null}
    </div>
  );
}

function CaughtUp() {
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col items-center justify-center px-8 py-16 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-pale text-green">
        <Check size={28} strokeWidth={2.6} aria-hidden />
      </span>
      <p className="mt-4 font-serif text-[1.5rem] font-semibold text-ink">You’re all caught up</p>
      <p className="mt-1 max-w-[30ch] text-[0.875rem] leading-relaxed text-secondary">New companies arrive as research adds them. Closed rounds wait on your watch list in Your picks.</p>
      <LinkButton href="/matches" variant="outline" className="mt-5">
        See matches
      </LinkButton>
    </div>
  );
}

function MatchOverlay({ card, members, tickedBy, onClose }: { card: SwipeCard; members: Member[]; tickedBy: string[]; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="match-title" className="fixed inset-0 z-50 flex animate-[fade-in_200ms_ease-out] flex-col items-center justify-center bg-ink-deep px-8 text-center text-white">
      <p className="text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-white/60">Two of you are interested</p>
      <h2 id="match-title" className="mt-2 animate-[match-pop_420ms_cubic-bezier(.2,1.4,.4,1)] font-serif text-[2.75rem] font-semibold leading-none">
        It’s a match!
      </h2>
      <div className="mt-7 flex -space-x-3">
        {members.map((m) => (
          <Avatar key={m.userId} member={m} size="lg" className="ring-4 ring-ink-deep" />
        ))}
      </div>
      <p className="mt-6 max-w-[30ch] text-[1rem] leading-relaxed text-white/85">
        You{tickedBy.length ? ` and ${joinNames(tickedBy)}` : ""} are interested in <span className="font-semibold text-white">{card.company.name}</span>. The chat is open to the whole family.
      </p>
      <Link href={`/matches/${card.company.slug}`} className="mt-8 inline-flex min-h-[50px] w-full max-w-[300px] items-center justify-center rounded-full bg-white px-6 text-[0.9375rem] font-semibold text-ink">
        Open the chat
      </Link>
      <button type="button" onClick={onClose} className="mt-3 min-h-[44px] px-6 text-[0.9375rem] font-medium text-white/80 hover:text-white">
        Keep going
      </button>
    </div>
  );
}

function DeckTip({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex animate-[fade-in_160ms_ease-out] items-end justify-center bg-ink/40" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="tip-title" className="w-full max-w-[480px] animate-[sheet-up_240ms_ease-out] rounded-t-[24px] bg-surface px-6 pb-[calc(24px+var(--safe-bottom))] pt-6" onClick={(e) => e.stopPropagation()}>
        <h2 id="tip-title" className="font-serif text-[1.5rem] font-semibold text-ink">
          How it works
        </h2>
        <ul className="mt-3 space-y-2.5 text-[0.9375rem] leading-relaxed text-text">
          <li className="flex gap-3">
            <Check size={20} className="mt-0.5 shrink-0 text-green" aria-hidden />
            <span><b>Interested</b> if it’s worth a conversation, <b>not interested</b> if not. You can add why, if you like.</span>
          </li>
          <li className="flex gap-3">
            <RotateCcw size={20} className="mt-0.5 shrink-0 text-amber" aria-hidden />
            <span><b>Undo</b> brings back the last one. Change any answer later in Profile → Your picks.</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[0.6875rem] font-bold text-white">2</span>
            <span>When <b>two of you are interested</b> in the same company it’s a match, and a family chat opens.</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[0.6875rem] font-bold text-secondary">?</span>
            <span>Your picks stay private until there’s a match.</span>
          </li>
        </ul>
        <Button size="lg" className="mt-5 w-full" onClick={onClose}>
          Got it
        </Button>
      </div>
    </div>
  );
}

function AlmostSheet({ card, onUndo, onClose }: { card: SwipeCard; onUndo: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex animate-[fade-in_160ms_ease-out] items-end justify-center bg-ink/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="almost-title"
        className="w-full max-w-[480px] animate-[sheet-up_240ms_ease-out] rounded-t-[24px] bg-surface px-6 pb-[calc(24px+var(--safe-bottom))] pt-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-amber">So close</p>
        <h2 id="almost-title" className="mt-1 font-serif text-[1.625rem] font-semibold text-ink">
          Almost a match
        </h2>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-secondary">
          One of the others is interested in <span className="font-semibold text-ink">{card.company.name}</span>. If you were too, it would have been a match.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button onClick={onUndo} size="lg">
            <RotateCcw size={17} aria-hidden />
            Undo my answer
          </Button>
          <Button variant="outline" size="lg" onClick={onClose}>
            Keep my answer
          </Button>
        </div>
      </div>
    </div>
  );
}

const REASONS = {
  interested: ["Strong team", "EIS/SEIS", "Early and cheap", "Real traction", "Love the sector", "Easy route in"],
  pass: ["Valuation too high", "No EIS/SEIS", "Too late stage", "Not our sector", "Team not convincing", "No route in"],
} as const;

/**
 * Optional "why?" after a yes or no. Starts as a small pill that fades on its
 * own; tapping it opens quick reasons and a note. Saved privately with the
 * answer, to learn what the family likes over time.
 */
function ReasonPrompt({ card, vote, onDone }: { card: SwipeCard; vote: "interested" | "pass"; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (open) return;
    const t = setTimeout(onDone, 9000);
    return () => clearTimeout(t);
  }, [open, onDone]);

  const save = () =>
    start(async () => {
      const note = [picked.join(", "), text.trim()].filter(Boolean).join(". ");
      const res = await saveReasonAction({ companyId: card.company.id, slug: card.company.slug, note });
      if (res.ok) onDone();
      else setError(res.error);
    });

  if (!open) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-height)+var(--safe-bottom)+84px)] z-30 flex justify-center px-4">
        <button type="button" onClick={() => setOpen(true)} className="pointer-events-auto inline-flex min-h-[40px] items-center gap-2 rounded-full bg-ink px-4 text-[0.8125rem] font-medium text-white shadow-[var(--shadow-float)]">
          <MessageSquarePlus size={16} aria-hidden />
          Say why you said {vote === "interested" ? "yes" : "no"} to {card.company.name}?
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex animate-[fade-in_160ms_ease-out] items-end justify-center bg-ink/40" onClick={onDone}>
      <div role="dialog" aria-modal="true" aria-labelledby="reason-title" className="w-full max-w-[480px] animate-[sheet-up_240ms_ease-out] rounded-t-[24px] bg-surface px-6 pb-[calc(24px+var(--safe-bottom))] pt-6" onClick={(e) => e.stopPropagation()}>
        <h2 id="reason-title" className="font-serif text-[1.375rem] font-semibold text-ink">
          Why {vote === "interested" ? "yes" : "no"} to {card.company.name}?
        </h2>
        <p className="mt-1 text-[0.8125rem] text-secondary">Optional and private. It helps the research learn what you like.</p>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Quick reasons">
          {REASONS[vote].map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={picked.includes(r)}
              onClick={() => setPicked((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]))}
              className={cn("min-h-[36px] rounded-full border px-3 text-[0.8125rem] font-medium", picked.includes(r) ? "border-ink bg-ink text-white" : "border-hairline-strong bg-surface text-ink")}
            >
              {r}
            </button>
          ))}
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={400} placeholder="Anything else? (optional)" aria-label="Your reason" className="mt-3 w-full rounded-[14px] border border-hairline-strong bg-page px-3 py-2 text-[0.9375rem] text-ink" />
        {error ? (
          <p role="alert" className="mt-1 text-[0.8125rem] text-red">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="lg" className="flex-1" onClick={onDone}>
            Skip
          </Button>
          <Button size="lg" className="flex-1" disabled={pending || (!picked.length && !text.trim())} onClick={save}>
            {pending ? "Saving…" : "Save reason"}
          </Button>
        </div>
      </div>
    </div>
  );
}
