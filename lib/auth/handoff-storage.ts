/** Browser-side record of a sign-in hand-off this device is waiting on. */
export type StoredHandoff = { id: string; secret: string; code: string; email: string; createdAt: number };

const KEY = "hv-signin-handoff";
export const HANDOFF_DONE_KEY = "hv-signin-handoff-done";
const MAX_AGE_MS = 60 * 60 * 1000;

/** Raw stored value, for useSyncExternalStore (a string is a stable snapshot). */
export function handoffSnapshot(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function parseHandoff(raw: string | null): StoredHandoff | null {
  try {
    const value = JSON.parse(raw ?? "null") as StoredHandoff | null;
    return value && Date.now() - value.createdAt < MAX_AGE_MS ? value : null;
  } catch {
    return null;
  }
}

export function readHandoff(): StoredHandoff | null {
  return parseHandoff(handoffSnapshot());
}

export function saveHandoff(value: StoredHandoff): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Private mode: polling still works while the screen stays open.
  }
}

export function clearHandoff(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Tells a waiting tab in this same browser that the link signed it in already. */
export function markHandoffDone(id: string): void {
  try {
    localStorage.setItem(HANDOFF_DONE_KEY, id);
  } catch {
    // ignore
  }
}
