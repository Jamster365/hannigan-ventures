import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/navigation/page-header";
import { Card, Pill } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import { formatDate } from "@/lib/domain/format";

export const metadata = { title: "Angel networks" };

export default async function NetworksPage() {
  await requireMember();
  const repo = await getRepository();
  const networks = await repo.listNetworks();
  return (
    <>
      <PageHeader title="Angel networks" backHref="/more" variant="back" />
      <div className="mx-auto max-w-[900px] px-4 pt-4">
        <p className="mb-3 text-[13px] text-secondary">Access routes into early rounds. Details are shown only once a research run has checked them against a source. Membership of a network never guarantees access to an allocation.</p>
        <ul className="grid gap-3 md:grid-cols-2">
          {networks.map((n) => (
            <li key={n.id}>
              <Card className="h-full p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-serif text-[17px] font-semibold leading-tight text-ink">{n.name}</h2>
                  <Pill tone={n.verificationStatus === "verified" ? "green" : n.verificationStatus === "partially_verified" ? "amber" : "neutral"}>{n.verificationStatus === "verified" ? "Verified" : n.verificationStatus === "partially_verified" ? "Partly verified" : "Unverified"}</Pill>
                </div>
                <dl className="mt-3 grid grid-cols-[96px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                  <dt className="text-secondary">Region</dt>
                  <dd className="text-ink">{n.region}</dd>
                  <dt className="text-secondary">Focus</dt>
                  <dd className="text-ink">{n.focus}</dd>
                  <dt className="text-secondary">Eligibility</dt>
                  <dd className="text-ink">{n.eligibility}</dd>
                  <dt className="text-secondary">Fees</dt>
                  <dd className="text-ink">{n.fees}</dd>
                  <dt className="text-secondary">Cheques</dt>
                  <dd className="text-ink">{n.chequeRequirements}</dd>
                  <dt className="text-secondary">Co-invest</dt>
                  <dd className="text-ink">{n.coInvestRoute}</dd>
                  <dt className="text-secondary">Checked</dt>
                  <dd className="text-ink">{n.lastCheckedAt ? formatDate(n.lastCheckedAt) : "Never"}</dd>
                </dl>
                <p className="mt-3 text-[12px] text-tertiary">{n.notes}</p>
                {n.website || n.joiningUrl ? (
                  <a href={n.joiningUrl ?? n.website ?? "#"} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-[36px] items-center gap-1 text-[13px] font-medium text-blue">
                    {n.joiningUrl ? "Joining information" : "Website"} <ExternalLink size={13} aria-hidden />
                  </a>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
