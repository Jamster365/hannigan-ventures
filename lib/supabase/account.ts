import "server-only";

/** Replaced in Milestone B. */
export async function updateDisplayName(_userId: string, _name: string): Promise<{ ok: true } | { ok: false; error: string }> {
  return { ok: false, error: "Not configured." };
}
