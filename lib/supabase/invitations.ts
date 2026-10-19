import "server-only";

/** Replaced in Milestone B. */
export async function listInvitations(): Promise<{ id: string; email: string; status: string; expiresAt: string }[]> {
  return [];
}

export async function createInvitation(_ownerId: string, _email: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  return { ok: false, error: "Not configured." };
}
