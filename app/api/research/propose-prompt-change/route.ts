import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentMember } from "@/lib/auth/current-member";
import { getRepository } from "@/lib/data";
import { proposePromptChange } from "@/lib/research/suggest";

const bodySchema = z.object({
  companyId: z.string().nullable().default(null),
  feedbackType: z.enum(["too_many_sector", "more_preseed", "missed_something", "not_this_model", "free_text"]),
  body: z.string().trim().max(1000).default(""),
});

/**
 * JSON endpoint behind "Improve our research". Records feedback and returns a
 * proposed prompt patch; nothing is applied until a member approves it in the
 * research settings UI.
 */
export async function POST(request: NextRequest) {
  const member = await getCurrentMember();
  if (!member) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const repo = await getRepository();
  const feedback = await repo.createFeedback({ ...parsed.data, authorUserId: member.userId });
  const active = await repo.getActivePrompt();
  const company = parsed.data.companyId ? await repo.getCompanyById(parsed.data.companyId) : null;
  const proposal = await proposePromptChange({ feedback, prompt: active, company: company?.company ?? null });
  if (!proposal) return NextResponse.json({ feedbackId: feedback.id, suggestion: null });
  const suggestion = await repo.createSuggestion({ feedbackId: feedback.id, basePromptVersionId: active.id, suggestedPatch: proposal.patch, rationale: proposal.rationale, expectedImpact: proposal.expectedImpact, suggestedBy: "ai" });
  return NextResponse.json({ feedbackId: feedback.id, suggestion });
}
