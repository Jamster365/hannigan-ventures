import { Briefcase } from "lucide-react";
import Link from "next/link";
import { CompanyArtwork } from "@/components/company/company-artwork";
import { PageHeader } from "@/components/navigation/page-header";
import { Card, EmptyState } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import { dealProgress, dealStatusLabel, type Deal } from "@/lib/domain/deal";
import { formatDate } from "@/lib/domain/format";
import type { CompanyBundle } from "@/lib/domain/types";

export const metadata = { title: "Investments" };

/**
 * What the family has actually invested in, what it is still working on,
 * and what it passed on after a match. Totals by member and by sector, so
 * the spread is visible before the next cheque.
 */
export default async function PortfolioPage() {
  const member = await requireMember();
  const repo = await getRepository();
  const [members, bundles, deals] = await Promise.all([repo.getMembers(), repo.listCompanies(), repo.listDeals()]);
  const rows = Object.entries(deals)
    .map(([companyId, deal]) => ({ bundle: bundles.find((b) => b.company.id === companyId), deal }))
    .filter((r): r is { bundle: CompanyBundle; deal: Deal } => Boolean(r.bundle));
  const invested = rows.filter((r) => r.deal.decision?.status === "invested").sort((a, b) => (b.deal.decision!.investedAt ?? "").localeCompare(a.deal.decision!.investedAt ?? ""));
  const working = rows.filter((r) => (r.deal.decision?.status ?? "considering") === "considering" && dealProgress(r.deal).done + r.deal.documents.length > 0);
  const passed = rows.filter((r) => r.deal.decision?.status === "passed");
  const totalOf = (deal: Deal) => Object.values(deal.decision?.amounts ?? {}).reduce((s, n) => s + (n || 0), 0);
  const total = invested.reduce((s, r) => s + totalOf(r.deal), 0);
  const byMember = members.map((m) => ({ m, sum: invested.reduce((s, r) => s + (r.deal.decision?.amounts[m.userId] || 0), 0) }));
  const bySector = [...invested.reduce((map, r) => map.set(r.bundle.company.sector, (map.get(r.bundle.company.sector) ?? 0) + totalOf(r.deal)), new Map<string, number>())].sort((a, b) => b[1] - a[1]);
  const certificatesMissing = invested.filter((r) => r.deal.decision?.scheme !== "none" && !r.deal.decision?.certificateReceived).length;

  return (
    <>
      <PageHeader width="max-w-[640px]" title="Investments" backHref="/me" variant="back" />
      <div className="mx-auto w-full max-w-[640px] px-4 pb-10 pt-3">
        {rows.length === 0 ? (
          <div className="pt-8">
            <EmptyState icon={<Briefcase size={28} />} title="Nothing recorded yet" body="When a match goes through due diligence and you invest, record it in the deal room and it appears here." />
          </div>
        ) : null}

        {invested.length ? (
          <Card className="p-4">
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-tertiary">Invested so far</p>
            <p className="mt-1 font-serif text-[2rem] font-semibold leading-none text-ink">£{total.toLocaleString("en-GB")}</p>
            <p className="mt-1 text-[0.8125rem] text-secondary">
              {invested.length} compan{invested.length === 1 ? "y" : "ies"} · {byMember.map((x) => `${x.m.userId === member.userId ? "you" : x.m.displayName} £${x.sum.toLocaleString("en-GB")}`).join(" · ")}
            </p>
            {bySector.length ? (
              <ul className="mt-3 space-y-1">
                {bySector.map(([sector, sum]) => (
                  <li key={sector} className="flex items-center gap-2 text-[0.8125rem]">
                    <span className="w-28 shrink-0 truncate text-secondary">{sector}</span>
                    <span className="h-2 rounded-full bg-blue" style={{ width: `${Math.max(4, (sum / total) * 100)}%` }} aria-hidden />
                    <span className="tnum text-ink">{Math.round((sum / total) * 100)}%</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {certificatesMissing ? <p className="mt-3 text-[0.8125rem] text-amber">{certificatesMissing} investment{certificatesMissing === 1 ? "" : "s"} still waiting for the SEIS3/EIS3 certificate needed to claim tax relief.</p> : null}
            <p className="mt-3 text-[0.75rem] text-tertiary">Angel returns are hit-driven: most funds aim for 15–20 companies over a few years, spread across sectors.</p>
          </Card>
        ) : null}

        <Group title="Invested" rows={invested} line={(r) => `£${totalOf(r.deal).toLocaleString("en-GB")}${r.deal.decision?.investedAt ? ` · ${formatDate(r.deal.decision.investedAt)}` : ""}${r.deal.decision?.scheme && r.deal.decision.scheme !== "unknown" ? ` · ${r.deal.decision.scheme === "none" ? "no relief" : r.deal.decision.scheme}` : ""}`} />
        <Group title="In due diligence" rows={working} line={(r) => { const p = dealProgress(r.deal); return `${p.done} of ${p.total} checks · ${p.documents} document${p.documents === 1 ? "" : "s"}`; }} />
        <Group title="Passed after a match" rows={passed} line={(r) => r.deal.decision?.notes || dealStatusLabel("passed")} />
      </div>
    </>
  );
}

function Group({ title, rows, line }: { title: string; rows: { bundle: CompanyBundle; deal: Deal }[]; line: (r: { bundle: CompanyBundle; deal: Deal }) => string }) {
  if (!rows.length) return null;
  return (
    <section className="mt-5">
      <h2 className="mb-2 px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-tertiary">{title}</h2>
      <Card className="overflow-hidden p-0">
        <ul className="divide-y divide-hairline">
          {rows.map((r) => (
            <li key={r.bundle.company.id}>
              <Link href={`/matches/${r.bundle.company.slug}/deal`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-muted/60">
                <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-hairline">
                  <CompanyArtwork company={r.bundle.company} media={r.bundle.media.find((m) => m.isPrimary) ?? r.bundle.media[0] ?? null} logo={r.bundle.media.find((m) => m.kind === "logo" && m.url && m.rightsStatus !== "fallback") ?? null} variant="thumb" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] font-semibold text-ink">{r.bundle.company.name}</span>
                  <span className="block truncate text-[0.75rem] text-secondary">{line(r)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
