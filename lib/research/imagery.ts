import type { SafeFetcher } from "./fetch";

/**
 * Company imagery (SPEC §3.4), best-effort and conservative.
 *
 * Only the company's own website is used, and only when that site was itself a
 * verified source for the company in this run, so a wrong website from the
 * model can never put another company's picture on a profile. From the home
 * page we take the image the company publishes for link previews (Open Graph /
 * Twitter card) as the hero and its touch icon or structured-data logo as the
 * logo. Pages that opt out of image indexing are skipped. Files must be real
 * raster images (PNG, JPEG, WebP, GIF; never SVG) of a sensible size.
 */

export type ImageType = "png" | "jpeg" | "webp" | "gif";
export interface FoundImage {
  kind: "hero" | "logo";
  originUrl: string;
  pageUrl: string;
  bytes: Uint8Array;
  type: ImageType;
  width: number;
  height: number;
}

const MAX_IMAGE_BYTES = 4_000_000;

export function parseAttributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return out;
}

function decodeEntities(v: string): string {
  return v.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

function absolute(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

/** Hero and logo candidates declared in a page's <head>, best first. */
export function extractImageCandidates(html: string, pageUrl: string): { optedOut: boolean; heroes: string[]; logos: string[] } {
  const head = html.slice(0, 300_000);
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map((m) => parseAttributes(m[0]));
  const links = [...head.matchAll(/<link\b[^>]*>/gi)].map((m) => parseAttributes(m[0]));
  const optedOut = metas.some((m) => /^(robots|googlebot)$/i.test(m.name ?? "") && /noimageindex|noindex|none/i.test(m.content ?? ""));

  const heroKeys = ["og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src"];
  const heroes = heroKeys.flatMap((k) => metas.filter((m) => (m.property ?? m.name ?? "").toLowerCase() === k).map((m) => absolute(m.content ?? "", pageUrl)));

  const iconSize = (l: Record<string, string>) => Number((l.sizes ?? "").split(/[x\s]/i)[0]) || 0;
  const touch = links.filter((l) => /apple-touch-icon/i.test(l.rel ?? "")).sort((a, b) => iconSize(b) - iconSize(a));
  const bigIcons = links.filter((l) => /(^|\s)icon(\s|$)/i.test(l.rel ?? "") && iconSize(l) >= 96).sort((a, b) => iconSize(b) - iconSize(a));
  const jsonLdLogos = [...head.matchAll(/"logo"\s*:\s*(?:"([^"]+)"|\{[^}]*?"url"\s*:\s*"([^"]+)")/g)].map((m) => m[1] ?? m[2]);
  const logos = [...jsonLdLogos.map((u) => absolute(u, pageUrl)), ...touch.map((l) => absolute(l.href ?? "", pageUrl)), ...bigIcons.map((l) => absolute(l.href ?? "", pageUrl))];

  const clean = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => Boolean(x) && !/\.svg(\?|#|$)/i.test(x!)))];
  return { optedOut, heroes: clean(heroes).slice(0, 3), logos: clean(logos).slice(0, 4) };
}

/** Reads type and pixel size from the file header; null for anything that is not a supported raster image. */
export function imageInfo(b: Uint8Array): { type: ImageType; width: number; height: number } | null {
  const u16be = (i: number) => (b[i] << 8) | b[i + 1];
  const u16le = (i: number) => b[i] | (b[i + 1] << 8);
  const u32be = (i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { type: "png", width: u32be(16), height: u32be(20) };
  if (b.length >= 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { type: "gif", width: u16le(6), height: u16le(8) };
  if (b.length >= 30 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") {
    const chunk = String.fromCharCode(...b.slice(12, 16));
    if (chunk === "VP8X") return { type: "webp", width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
    if (chunk === "VP8 ") return { type: "webp", width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff };
    if (chunk === "VP8L") return { type: "webp", width: 1 + (((b[22] & 0x3f) << 8) | b[21]), height: 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6)) };
    return null;
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      // Start-of-frame markers carry the dimensions (excluding DHT/JPG/DAC).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { type: "jpeg", height: u16be(i + 5), width: u16be(i + 7) };
      i += 2 + u16be(i + 2);
    }
  }
  return null;
}

function acceptable(kind: "hero" | "logo", w: number, h: number): boolean {
  if (!w || !h) return false;
  const ratio = w / h;
  return kind === "hero" ? w >= 600 && h >= 300 && ratio >= 1.2 && ratio <= 2.6 : Math.min(w, h) >= 96 && ratio >= 0.5 && ratio <= 4;
}

/** Same registrable host, ignoring a leading "www.". */
export function sameSite(a: string, b: string): boolean {
  try {
    const strip = (u: string) => new URL(u).hostname.toLowerCase().replace(/^www\./, "");
    return strip(a) === strip(b);
  } catch {
    return false;
  }
}

export async function findCompanyImagery(input: { website: string; verifiedUrls: string[] }, fetcher: SafeFetcher): Promise<FoundImage[]> {
  const home = absolute(input.website.includes("://") ? input.website : `https://${input.website}`, "https://invalid.example");
  if (!home || !input.verifiedUrls.some((u) => sameSite(u, home))) return [];
  const page = await fetcher(home, { maxBytes: 600_000, timeoutMs: 8000 });
  if (!page.ok || !page.text || !sameSite(page.finalUrl, home)) return [];
  const { optedOut, heroes, logos } = extractImageCandidates(page.text, page.finalUrl);
  if (optedOut) return [];

  const found: FoundImage[] = [];
  for (const [kind, urls] of [["hero", heroes], ["logo", logos]] as const) {
    for (const url of urls) {
      const res = await fetcher(url, { binary: true, maxBytes: MAX_IMAGE_BYTES, timeoutMs: 8000 });
      if (!res.ok || !res.bytes) continue;
      const info = imageInfo(res.bytes);
      if (!info || !acceptable(kind, info.width, info.height)) continue;
      found.push({ kind, originUrl: res.finalUrl, pageUrl: page.finalUrl, bytes: res.bytes, ...info });
      break;
    }
  }
  return found;
}
