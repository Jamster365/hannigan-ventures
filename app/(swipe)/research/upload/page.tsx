import { notFound } from "next/navigation";
import { PageHeader } from "@/components/navigation/page-header";
import { CopyPrompt, UploadForm } from "@/components/research/upload-form";
import { Card, Pill, type Tone } from "@/components/ui/primitives";
import { requireMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import { formatDateTime } from "@/lib/domain/format";
import type { ResearchRun } from "@/lib/domain/types";
import { IMPORT_BATCH_SIZE } from "@/lib/research/import-batch";
import { claudeBatchPrompt } from "@/lib/research/import-template";

export const metadata = { title: "Upload research" };

const tone: Record<ResearchRun["status"], Tone> = { published: "green", running: "blue", queued: "neutral", failed: "red", no_new_research: "amber" };
const label: Record<ResearchRun["status"], string> = { published: "Published", running: "Waiting or running", queued: "Queued", failed: "Failed", no_new_research: "Nothing new" };

/**
 * Owner-only: research a batch of companies in a Claude chat (on the owner's
 * own Claude plan, no API cost), then upload the result here.
 */
export default async function UploadResearchPage() {
  const member = await requireMember();
  if (member.role !== "owner") notFound();
  const repo = await getRepository();
  const [bundles, prompt, runs] = await Promise.all([repo.listCompanies(), repo.getActivePrompt(), repo.listRuns()]);
  const known = bundles.filter((b) => !b.company.isDemo).map((b) => b.company.name).sort();
  const uploads = runs.filter((r) => r.model.startsWith("Upload:") || r.model.startsWith("Claude chat research")).slice(0, 15);

  return (
    <>
      <PageHeader title="Upload research" backHref="/me" variant="back" />
      <div className="mx-auto max-w-[720px] space-y-5 px-4 pb-10 pt-4">
        <p className="text-[0.8125rem] text-secondary">
          Only you can see this page. New companies come from big research sessions in a Claude chat; the daily automatic run only keeps existing companies up to date.
        </p>
        <Card className="p-4">
          <h2 className="font-serif text-[1.125rem] font-semibold text-ink">1. Research in Claude</h2>
          <p className="mb-3 mt-1 text-[0.8125rem] text-secondary">Copy the prompt into a new Claude chat with web search on. It already lists the {known.length} companies you track, so Claude skips them.</p>
          <CopyPrompt prompt={claudeBatchPrompt({ maxChequeGbp: prompt.config.maxChequeGbp, known })} />
        </Card>
        <Card className="p-4">
          <h2 className="font-serif text-[1.125rem] font-semibold text-ink">2. Upload Claude’s reply</h2>
          <p className="mb-3 mt-1 text-[0.8125rem] text-secondary">Big batches are split into runs of {IMPORT_BATCH_SIZE}. Companies you already track are updated rather than duplicated.</p>
          <UploadForm />
        </Card>
        {uploads.length ? (
          <section>
            <h2 className="mb-2 px-1 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-tertiary">Recent uploads</h2>
            <Card className="overflow-hidden p-0">
              <ul className="divide-y divide-hairline">
                {uploads.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-[0.875rem] font-medium text-ink">{r.model.replace(/^Upload: /, "")}</p>
                      <p className="text-[0.75rem] text-secondary">
                        {formatDateTime(r.startedAt)}
                        {r.status === "published" ? ` · ${r.publishedCount} published` : ""}
                      </p>
                    </div>
                    <Pill tone={tone[r.status]}>{label[r.status]}</Pill>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ) : null}
      </div>
    </>
  );
}
