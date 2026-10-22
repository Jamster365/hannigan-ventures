import { PageHeader } from "@/components/navigation/page-header";
import { Card } from "@/components/ui/primitives";
import { ACCESS_FRESHNESS_HOURS } from "@/lib/domain/company-status";

export const metadata = { title: "About & methodology" };

const sections = [
  {
    title: "What this is",
    body: "A private research journal for three family members. It discovers early-stage companies each morning, checks sources, and lets each member tick or cross each one. It is not a brokerage, does not move money and gives no investment advice.",
  },
  {
    title: "How matches work",
    body: "Each member ticks or crosses every company in their deck, and the others' choices stay hidden here (the classic app still shows votes). When all three tick the same company it is a match: it moves to Matches and opens a shared chat. A single cross ends it; if yours was the deciding cross after the other two ticked, you are told it was almost a match and can undo. A match means \"worth a conversation\", never \"let's invest\". Nothing is overridden by hand or by the AI.",
  },
  {
    title: "How the AI rating works",
    body: "The AI research rating (0–10) is a research-priority opinion built from cited evidence: founders, product, traction, market, valuation, access and timing. It is only given when evidence is sufficient; otherwise the company is shown as Not rated. Dimensions with no evidence (for example an undisclosed valuation) stay unrated rather than being assumed. The rating is never combined with family scores and is not a probability of success.",
  },
  {
    title: "Evidence and unknowns",
    body: "Every material fact carries a source, a date and an evidence status: independently verified, company claim, third-party report, analyst inference or unknown. Where something is not known it is shown as Unknown. Figures that appear in design mockups are never treated as facts.",
  },
  {
    title: "Can invest now",
    body: `The label appears only when a live application or operator-confirmed route has been verified within the last ${ACCESS_FRESHNESS_HOURS} hours, supports a cheque within the household maximum and no closure has been reported. It expires automatically. A route to apply never guarantees an allocation.`,
  },
  {
    title: "EIS and SEIS",
    body: "Documented eligibility is distinguished from a company's own claim, from pending status and from unknown. HMRC advance assurance is not the same as guaranteed relief for an individual investment.",
  },
  {
    title: "Imagery",
    body: "Company pages use permitted company imagery with attribution where available. Where no permitted image exists, a designed typographic card is shown. No generated photographs are ever presented as a company's real product, founders or office.",
  },
  {
    title: "Research instructions",
    body: "All three members can read and edit the discovery instructions used for each morning's research. Every change is saved as a numbered version with its author. Feedback from a company card produces a proposed change that must be reviewed and applied by a member; the AI never edits its own instructions. Evidence, security and formatting rules sit outside the editable text.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader title="About & methodology" backHref="/me" variant="back" />
      <div className="mx-auto max-w-[760px] px-4 pt-4">
        <div className="space-y-3">
          {sections.map((s) => (
            <Card key={s.title} className="p-4">
              <h2 className="font-serif text-[18px] font-semibold text-ink">{s.title}</h2>
              <p className="mt-1.5 text-[14px] leading-relaxed text-text">{s.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
