import { BellRing, ExternalLink } from "lucide-react";
import { AccessPill } from "@/components/company/status-badges";
import { EvidencePill, SourceRef } from "@/components/company/source-link";
import { BookmarkButton } from "@/components/company/bookmark-button";
import { Pill } from "@/components/ui/primitives";
import { eisLabel, effectiveAccess } from "@/lib/domain/company-status";
import { formatDate, formatDateTime, formatMoney } from "@/lib/domain/format";
import type { CompanyBundle } from "@/lib/domain/types";

export function FundingTab({ bundle, currentUserId, maxChequeGbp }: { bundle: CompanyBundle; currentUserId: string; maxChequeGbp: number }) {
  const { company, rounds, accessChecks, sources } = bundle;
  const byId = new Map(sources.map((s) => [s.id, s]));
  const current = rounds.find((r) => r.isCurrent) ?? null;
  const previous = rounds.filter((r) => !r.isCurrent).sort((a, b) => (b.closesAt ?? "").localeCompare(a.closesAt ?? ""));
  const access = effectiveAccess(accessChecks, { maxChequeGbp });
  const check = access.check;

  const rows: { label: string; value: string; hint?: string }[] = current
    ? [
        { label: "Stage", value: current.stage },
        { label: "Target raise", value: formatMoney(current.targetAmount, current.currency) },
        { label: "Reported committed", value: current.reportedCommitted !== null ? formatMoney(current.reportedCommitted, current.currency) : "Unknown", hint: "Reported, not necessarily available" },
        { label: "Pre-money valuation", value: formatMoney(current.preMoney, current.currency) },
        { label: "Post-money valuation", value: formatMoney(current.postMoney, current.currency) },
        { label: "EIS/SEIS", value: eisLabel(company.eisStatus), hint: company.eisNote },
        { label: "Status", value: statusLabel(current.claimedStatus), hint: current.evidenceStatus === "official_company_claim" ? "As stated by the company" : current.evidenceStatus === "third_party_report" ? "Reported by a third party" : undefined },
        { label: "Opens", value: current.openedAt ? formatDate(current.openedAt) : "Unknown" },
        { label: "Close date", value: current.closesAt ? formatDate(current.closesAt) : "Unknown", hint: current.closesAt ? "A close date alone does not confirm closure" : undefined },
        { label: "Lead investors", value: current.leadInvestors.length ? current.leadInvestors.join(", ") : "Unknown" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-[20px] font-semibold text-ink">Latest round</h2>
          {current ? <EvidencePill status={current.evidenceStatus} /> : null}
        </div>
        {current ? (
          <dl className="mt-2 divide-y divide-hairline rounded-[var(--radius-card)] border border-hairline bg-surface">
            {rows.map((r) => (
              <div key={r.label} className="grid grid-cols-[120px_1fr] gap-3 px-4 py-2.5">
                <dt className="text-[13px] text-secondary">{r.label}</dt>
                <dd className="text-[14px] font-medium text-ink">
                  {r.value}
                  {r.hint ? <span className="block text-[11px] font-normal text-tertiary">{r.hint}</span> : null}
                </dd>
              </div>
            ))}
            {current.sourceId ? (
              <div className="px-4 py-2.5 text-[12px] text-tertiary">
                Source <SourceRef source={byId.get(current.sourceId)} /> {byId.get(current.sourceId)?.publisher}, {formatDate(byId.get(current.sourceId)?.publishedAt)}
              </div>
            ) : (
              <div className="px-4 py-2.5 text-[12px] text-tertiary">No source attached to these round details.</div>
            )}
          </dl>
        ) : (
          <p className="mt-2 rounded-[14px] bg-surface-muted px-4 py-5 text-center text-[14px] text-secondary">No round information recorded.</p>
        )}
      </section>

      <section>
        <h2 className="font-serif text-[20px] font-semibold text-ink">Access</h2>
        <div className="mt-2 rounded-[var(--radius-card)] border border-hairline bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <AccessPill access={access} />
            {access.isStale ? <Pill tone="amber">Stale check</Pill> : null}
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-text">{access.reason}</p>
          {check ? (
            <dl className="mt-3 grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
              <dt className="text-secondary">Route</dt>
              <dd className="text-ink">{routeLabel(check.routeType)}</dd>
              <dt className="text-secondary">Contact / link</dt>
              <dd className="text-ink">
                {check.contactOrUrl ? (
                  check.contactOrUrl.startsWith("http") ? (
                    <a href={check.contactOrUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue">
                      Open route <ExternalLink size={12} aria-hidden />
                    </a>
                  ) : (
                    check.contactOrUrl
                  )
                ) : (
                  "None recorded"
                )}
              </dd>
              <dt className="text-secondary">Cheque</dt>
              <dd className="text-ink">
                {check.minCheque !== null ? `Min ${formatMoney(check.minCheque, check.currency)}` : "Minimum unknown"}
                {check.maxCheque !== null ? ` · Max ${formatMoney(check.maxCheque, check.currency)}` : ""}
              </dd>
              <dt className="text-secondary">Checked</dt>
              <dd className="text-ink">
                {formatDateTime(check.checkedAt)} · {check.verifier}
              </dd>
              {check.expiresAt ? (
                <>
                  <dt className="text-secondary">Expires</dt>
                  <dd className="text-ink">{formatDate(check.expiresAt)}</dd>
                </>
              ) : null}
              {check.notes ? (
                <>
                  <dt className="text-secondary">Notes</dt>
                  <dd className="text-ink">{check.notes}</dd>
                </>
              ) : null}
            </dl>
          ) : null}
          <p className="mt-3 text-[12px] text-tertiary">An application route never guarantees an allocation. Live status expires automatically after 48 hours without re-verification.</p>
          <div className="mt-3 flex items-center gap-2 rounded-full bg-blue-pale px-3 py-1.5 text-[13px] font-medium text-blue">
            <BellRing size={15} aria-hidden />
            <span className="flex-1">Bookmark to follow access changes</span>
            <BookmarkButton companyId={company.id} slug={company.slug} bookmarked={bundle.bookmarkedBy.includes(currentUserId)} variant="plain" className="h-8 w-8 text-blue" />
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-serif text-[20px] font-semibold text-ink">Funding history</h2>
        {previous.length ? (
          <ul className="mt-2 space-y-2">
            {previous.map((r) => (
              <li key={r.id} className="rounded-[14px] border border-hairline bg-surface px-4 py-3 text-[13px]">
                <p className="font-semibold text-ink">
                  {r.stage} · {formatMoney(r.targetAmount ?? r.reportedCommitted, r.currency)}
                </p>
                <p className="text-secondary">
                  {r.closesAt ? formatDate(r.closesAt) : "Date unknown"} · {statusLabel(r.claimedStatus)}
                  <SourceRef source={r.sourceId ? byId.get(r.sourceId) : undefined} />
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[14px] text-secondary">No previous rounds found.</p>
        )}
      </section>
    </div>
  );
}

function statusLabel(s: "open" | "closed" | "expected" | "unknown") {
  return s === "open" ? "Open (reported)" : s === "closed" ? "Closed (reported)" : s === "expected" ? "Expected" : "Unknown";
}

function routeLabel(r: NonNullable<CompanyBundle["accessChecks"][number]>["routeType"]) {
  switch (r) {
    case "official_application":
      return "Official application";
    case "syndicate":
      return "Syndicate";
    case "founder_intro":
      return "Founder introduction";
    case "spv":
      return "SPV";
    case "platform":
      return "Platform";
    default:
      return "None";
  }
}
