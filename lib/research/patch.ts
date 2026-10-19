/**
 * Prompt suggestions are expressed as exact-match find/replace patches so the
 * member can see precisely what would change. If any `find` no longer occurs
 * exactly once in the current prompt, the patch is rejected (returns null)
 * rather than applied loosely.
 */
export function applyPatch(text: string, patch: { find: string; replace: string }[]): string | null {
  let out = text;
  for (const p of patch) {
    const first = out.indexOf(p.find);
    if (first === -1) return null;
    if (out.indexOf(p.find, first + 1) !== -1) return null;
    out = out.slice(0, first) + p.replace + out.slice(first + p.find.length);
  }
  return out;
}

export interface DiffLine {
  kind: "same" | "added" | "removed";
  text: string;
}

/** Simple line-level LCS diff for previewing prompt changes. */
export function diffLines(a: string, b: string): DiffLine[] {
  const al = a.split("\n");
  const bl = b.split("\n");
  const n = al.length;
  const m = bl.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = al[i] === bl[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (al[i] === bl[j]) {
      out.push({ kind: "same", text: al[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: "removed", text: al[i] });
      i++;
    } else {
      out.push({ kind: "added", text: bl[j] });
      j++;
    }
  }
  while (i < n) out.push({ kind: "removed", text: al[i++] });
  while (j < m) out.push({ kind: "added", text: bl[j++] });
  return out;
}
