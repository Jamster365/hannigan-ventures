export const COMPANY_TABS = [
  { key: "overview", label: "Overview" },
  { key: "analysis", label: "Analysis" },
  { key: "funding", label: "Funding" },
  { key: "team", label: "Team" },
  { key: "updates", label: "Updates" },
  { key: "family", label: "Family" },
  { key: "sources", label: "Sources" },
] as const;

export type CompanyTabKey = (typeof COMPANY_TABS)[number]["key"];

export function isTabKey(v: string | undefined): v is CompanyTabKey {
  return COMPANY_TABS.some((t) => t.key === v);
}
