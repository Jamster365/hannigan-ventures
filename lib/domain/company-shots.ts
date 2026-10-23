import shots from "@/public/company-shots/index.json";
import type { Company } from "./types";

/**
 * Screenshots of companies' own homepages (scripts/screenshot-companies.mjs),
 * shown when a company has no photo of its own. Real, from the company's own
 * site, and labelled as a screenshot wherever they appear.
 */
const INDEX = shots as Record<string, { file: string; takenAt: string }>;

export function homepageShot(company: Pick<Company, "domain">): { url: string; takenAt: string } | null {
  const domain = company.domain?.replace(/^www\./, "");
  const hit = domain ? INDEX[domain] : undefined;
  return hit ? { url: `/company-shots/${hit.file}`, takenAt: hit.takenAt } : null;
}

export type SceneKind = "climate" | "health" | "money" | "software" | "consumer" | "build" | "farm" | "move";

/** Which illustrated scene suits a company's field. */
export function sceneFor(sector: string, subSector?: string | null): SceneKind {
  const s = `${sector} ${subSector ?? ""}`.toLowerCase();
  if (/agri|agtech|farm|crop|food tech|aqua/.test(s)) return "farm";
  if (/climate|energy|carbon|circular|clean|solar|battery|water/.test(s)) return "climate";
  if (/health|med|bio|life sci|pharma|neuro|therap|diagnos|care|femtech/.test(s)) return "health";
  if (/fin|insur|pay|bank|credit|mortgage|invest|wealth|legal|reg/.test(s)) return "money";
  if (/mobility|logistic|transport|travel|automotive|drone/.test(s)) return "move";
  if (/robot|manufactur|industrial|hardware|construct|prop|material|deep tech|iot/.test(s)) return "build";
  if (/consumer|drink|food|beauty|retail|hospitality|sport|fashion|wine|spirit|media|creative|marketplace/.test(s)) return "consumer";
  return "software";
}
