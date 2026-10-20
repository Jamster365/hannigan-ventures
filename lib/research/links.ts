/** Links a model wrote into its answer (markdown or bare), without trailing punctuation. */
export function linksInText(text: string): string[] {
  return [...text.matchAll(/https?:\/\/[^\s<>"'`\]\[)(]+/g)].map((m) => m[0].replace(/[.,;:!?*_]+$/, ""));
}
