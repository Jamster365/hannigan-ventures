/**
 * Research batches prepared in Claude Code sessions and shipped with the app.
 * Each file holds { label, payload: { writeUp, companies } } as written by
 * scripts/check-research-import.ts. The heartbeat queues each batch once.
 * Add a new batch by dropping its file in data/research-pool and listing it here.
 */
export const RESEARCH_POOL: { label: string; data: unknown }[] = [];
