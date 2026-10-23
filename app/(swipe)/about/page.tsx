import { PageHeader } from "@/components/navigation/page-header";
import { Card } from "@/components/ui/primitives";
import { ACCESS_FRESHNESS_HOURS } from "@/lib/domain/company-status";

export const metadata = { title: "About & methodology" };

const sections = [
  {
    title: "What this is",
    body: "A private research journal for three family members. It discovers early-stage companies each morning, checks sources, and lets each member say whether they are interested in each one. It is not a brokerage, does not move money and gives no investment advice.",
  },
  {
    title: "How matches work",
    body: "Each of you answers interested or not interested to every company; answers stay private until there is a match.",
    bullets: [
      "Two of you interested = a match. It opens a chat and a deal room for the whole family. Two not interested ends it.",
      "If your no was the deciding answer and a yes would have made a match, you are told it was almost a match and can undo.",
      "Change any answer later in Profile → Your picks. Companies whose round has closed wait on the watch list.",
      "A match means “worth a conversation”, never “let’s invest”. Nothing is overridden by hand or by the AI.",
      "Your deck’s order is learned from your answers, your reasons and your preferences (Profile → Your taste), with one card in five or so something a bit different. Only the order changes; nothing is hidden. The only hard rules: UK companies, and no closed rounds.",
    ],
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
      <div className="mx-auto w-full max-w-[760px] px-4 pt-4">
        <div className="space-y-3">
          {sections.map((s) => (
            <Card key={s.title} className="p-4">
              <h2 className="font-serif text-[1.125rem] font-semibold text-ink">{s.title}</h2>
              <p className="mt-1.5 text-[0.875rem] leading-relaxed text-text">{s.body}</p>
              {s.bullets ? (
                <ul className="mt-2 space-y-1.5 text-[0.875rem] leading-relaxed text-text">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-blue" aria-hidden />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
