/**
 * Model output gives dates at whatever precision the source had ("2024-11",
 * "2024", "15 Nov 2024"). Postgres date/timestamp columns need a full date, so
 * normalise to YYYY-MM-DD (start of the stated month/year) or null when it
 * cannot be read. Precision is not invented beyond what the source states:
 * "2024-11" becomes 1 Nov 2024, the conventional start-of-period date.
 */
export function toIsoDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return valid(`${ymd[1]}-${ymd[2]}-${ymd[3]}`);
  const ym = s.match(/^(\d{4})-(\d{1,2})$/);
  if (ym) return valid(`${ym[1]}-${ym[2].padStart(2, "0")}-01`);
  if (/^\d{4}$/.test(s)) return valid(`${s}-01-01`);
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function valid(iso: string): string | null {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}
