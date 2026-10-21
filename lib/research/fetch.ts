import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

/**
 * SSRF-defended retrieval for source verification (SPEC §11.1).
 *  - http(s) only, no credentials in URL
 *  - blocks localhost, link-local, private and metadata ranges (after DNS)
 *  - bounded size and time, no automatic cross-host redirects to private hosts
 */
export interface FetchResult {
  ok: boolean;
  status: number;
  finalUrl: string;
  contentType: string | null;
  text: string | null;
  /** Raw body, only when requested with `binary: true` (text is then null). */
  bytes?: Uint8Array;
  error?: string;
}

export interface SafeFetcher {
  (url: string, opts?: { maxBytes?: number; timeoutMs?: number; method?: "GET" | "HEAD"; binary?: boolean }): Promise<FetchResult>;
}

const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal", "169.254.169.254"]);

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v6 = ip.toLowerCase();
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("::ffff:127.") || v6.startsWith("::ffff:10.") || v6.startsWith("::ffff:192.168.");
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("unsupported scheme");
  if (url.username || url.password) throw new Error("credentials in URL");
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".invalid")) throw new Error("blocked host");
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new Error("private address");
    return url;
  }
  try {
    const addrs = await lookup(host, { all: true });
    if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) throw new Error("resolves to private address");
  } catch (e) {
    throw new Error(e instanceof Error && e.message.includes("private") ? e.message : "DNS lookup failed");
  }
  return url;
}

export const safeFetch: SafeFetcher = async (raw, opts = {}) => {
  const maxBytes = opts.maxBytes ?? 1_500_000;
  const timeoutMs = opts.timeoutMs ?? 12_000;
  let url: URL;
  try {
    url = await assertPublicUrl(raw);
  } catch (e) {
    return { ok: false, status: 0, finalUrl: raw, contentType: null, text: null, error: e instanceof Error ? e.message : "blocked" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; HanniganVenturesResearch/1.0; +https://hannigan-ventures.vercel.app; private household research, low volume)", "accept-language": "en-GB,en;q=0.9", accept: opts.binary ? "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9" : "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.5" },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { ok: false, status: res.status, finalUrl: url.href, contentType: null, text: null, error: "redirect without location" };
      const next = new URL(loc, url);
      // Follow one redirect, re-validating the destination.
      const nested = await safeFetch(next.href, { ...opts, timeoutMs: Math.max(2000, timeoutMs / 2) });
      return nested;
    }
    const contentType = res.headers.get("content-type");
    if (opts.method === "HEAD") return { ok: res.ok, status: res.status, finalUrl: url.href, contentType, text: null };
    const reader = res.body?.getReader();
    let received = 0;
    const chunks: Uint8Array[] = [];
    let truncated = false;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          received += value.byteLength;
          if (received > maxBytes) {
            truncated = true;
            await reader.cancel();
            break;
          }
          chunks.push(value);
        }
      }
    }
    // A truncated binary file is unusable; a truncated page still has its <head>.
    if (opts.binary) return truncated ? { ok: false, status: res.status, finalUrl: url.href, contentType, text: null, error: "file too large" } : { ok: res.ok, status: res.status, finalUrl: url.href, contentType, text: null, bytes: concat(chunks) };
    const text = new TextDecoder("utf-8", { fatal: false }).decode(concat(chunks));
    return { ok: res.ok, status: res.status, finalUrl: url.href, contentType, text };
  } catch (e) {
    return { ok: false, status: 0, finalUrl: url.href, contentType: null, text: null, error: e instanceof Error ? e.message : "fetch failed" };
  } finally {
    clearTimeout(timer);
  }
};

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/** Strip tags and scripts to a readable excerpt for evidence checks and excerpts. */
export function htmlToText(html: string, max = 20_000): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  return m ? m[1].trim() : null;
}

export function canonicaliseUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$)/i.test(k)) u.searchParams.delete(k);
    u.hostname = u.hostname.toLowerCase();
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
    return u.href;
  } catch {
    return raw;
  }
}
