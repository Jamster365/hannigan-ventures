import "server-only";

/** Replaced in Milestone B with the Supabase magic-link implementation. */
export async function sendMagicLink(_email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  return { ok: false, error: "Authentication is not configured." };
}

export async function signOut(): Promise<void> {}
