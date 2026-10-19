import { ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/domain/format";
import type { EvidenceStatus, Source } from "@/lib/domain/types";
import { Pill, type Tone } from "@/components/ui/primitives";

export function evidenceMeta(status: EvidenceStatus): { label: string; tone: Tone } {
  switch (status) {
    case "verified_independent":
      return { label: "Independently verified", tone: "green" };
    case "official_company_claim":
      return { label: "Company claim", tone: "blue" };
    case "third_party_report":
      return { label: "Third-party report", tone: "violet" };
    case "analyst_inference":
      return { label: "Inference", tone: "amber" };
    default:
      return { label: "Unverified", tone: "neutral" };
  }
}

export function EvidencePill({ status, className }: { status: EvidenceStatus; className?: string }) {
  const m = evidenceMeta(status);
  return (
    <Pill tone={m.tone} className={className}>
      {m.label}
    </Pill>
  );
}

/** Inline citation marker linking to a source. */
export function SourceRef({ source, index }: { source: Source | undefined; index?: number }) {
  if (!source) return null;
  return (
    <a
      href={source.canonicalUrl}
      target="_blank"
      rel="noopener noreferrer"
      title={`${source.title} — ${source.publisher}, ${formatDate(source.publishedAt)}`}
      className="ml-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-blue-pale px-1 align-middle text-[10px] font-semibold text-blue no-underline"
    >
      {index ?? <ExternalLink size={10} aria-hidden />}
      <span className="sr-only">Source: {source.title}</span>
    </a>
  );
}
