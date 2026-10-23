/**
 * Research batches prepared in Claude Code sessions and shipped with the app.
 * Each file holds { label, payload: { writeUp, companies } } (the shape written
 * by scripts/check-research-import.ts). The heartbeat queues each batch once,
 * then the normal pipeline verifies every source before anything is published.
 * Add a batch by dropping its file in data/research-pool and listing it here.
 */
import accelerators from "@/data/research-pool/2026-10-23-accelerators.json";
import crowdfunding from "@/data/research-pool/2026-10-23-crowdfunding.json";
import spinouts from "@/data/research-pool/2026-10-23-spinouts.json";
import news from "@/data/research-pool/2026-10-23-news.json";
import angelNetworks from "@/data/research-pool/2026-10-23-angel-networks.json";
import eisPlatforms from "@/data/research-pool/2026-10-23-eis-platforms.json";

type PoolFile = { label: string; payload: unknown };

export const RESEARCH_POOL: { label: string; data: unknown }[] = ([eisPlatforms, angelNetworks, accelerators, spinouts, crowdfunding, news] as PoolFile[]).map((f) => ({ label: f.label, data: f.payload }));
