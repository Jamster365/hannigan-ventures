import { describe, expect, it } from "vitest";
import type { SafeFetcher } from "@/lib/research/fetch";
import { extractImageCandidates, findCompanyImagery, imageInfo } from "@/lib/research/imagery";

function png(width: number, height: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, width);
  new DataView(b.buffer).setUint32(20, height);
  return b;
}

function jpeg(width: number, height: number): Uint8Array {
  // SOI, an APP0 segment, then SOF0 with height/width.
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x03, 0, 0, 0, 0]);
}

const PAGE = `<html><head>
  <meta property="og:image" content="/media/share.jpg?v=1&amp;x=2">
  <meta name="twitter:image" content="https://cdn.acme.example/card.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
</head><body>Acme</body></html>`;

function stubFetcher(files: Record<string, { text?: string; bytes?: Uint8Array; finalUrl?: string }>): SafeFetcher & { calls: string[] } {
  const calls: string[] = [];
  const fn = (async (url: string) => {
    calls.push(url);
    const f = files[url];
    if (!f) return { ok: false, status: 404, finalUrl: url, contentType: null, text: null };
    return { ok: true, status: 200, finalUrl: f.finalUrl ?? url, contentType: null, text: f.text ?? null, bytes: f.bytes };
  }) as SafeFetcher & { calls: string[] };
  fn.calls = calls;
  return fn;
}

describe("company imagery", () => {
  it("reads share images and logos from the page head, resolving relative URLs and skipping SVG", () => {
    const c = extractImageCandidates(PAGE, "https://acme.example/");
    expect(c.optedOut).toBe(false);
    expect(c.heroes).toEqual(["https://acme.example/media/share.jpg?v=1&x=2", "https://cdn.acme.example/card.png"]);
    expect(c.logos).toEqual(["https://acme.example/apple-touch-icon.png"]);
  });

  it("respects pages that opt out of image indexing", () => {
    expect(extractImageCandidates(`<meta name="robots" content="noimageindex">${PAGE}`, "https://acme.example/").optedOut).toBe(true);
  });

  it("reads real image dimensions and rejects non-images", () => {
    expect(imageInfo(png(1200, 630))).toEqual({ type: "png", width: 1200, height: 630 });
    expect(imageInfo(jpeg(1600, 900))).toEqual({ type: "jpeg", width: 1600, height: 900 });
    expect(imageInfo(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
  });

  it("takes a landscape hero and a logo from the company's own verified site", async () => {
    const fetcher = stubFetcher({
      "https://acme.example/": { text: PAGE },
      "https://acme.example/media/share.jpg?v=1&x=2": { bytes: jpeg(1200, 630) },
      "https://acme.example/apple-touch-icon.png": { bytes: png(180, 180) },
    });
    const found = await findCompanyImagery({ website: "acme.example", verifiedUrls: ["https://www.acme.example/about"] }, fetcher);
    expect(found.map((f) => [f.kind, f.originUrl, f.width])).toEqual([
      ["hero", "https://acme.example/media/share.jpg?v=1&x=2", 1200],
      ["logo", "https://acme.example/apple-touch-icon.png", 180],
    ]);
  });

  it("never fetches anything when the website was not a verified source", async () => {
    const fetcher = stubFetcher({ "https://acme.example/": { text: PAGE } });
    expect(await findCompanyImagery({ website: "https://acme.example", verifiedUrls: ["https://news.example/acme-raises"] }, fetcher)).toEqual([]);
    expect(fetcher.calls).toEqual([]);
  });

  it("rejects small or oddly shaped heroes and falls back to the next candidate", async () => {
    const fetcher = stubFetcher({
      "https://acme.example/": { text: PAGE },
      "https://acme.example/media/share.jpg?v=1&x=2": { bytes: jpeg(300, 300) },
      "https://cdn.acme.example/card.png": { bytes: png(1000, 500) },
    });
    const found = await findCompanyImagery({ website: "https://acme.example", verifiedUrls: ["https://acme.example/"] }, fetcher);
    expect(found.find((f) => f.kind === "hero")?.originUrl).toBe("https://cdn.acme.example/card.png");
  });

  it("ignores a homepage that redirects to a different site", async () => {
    const fetcher = stubFetcher({ "https://acme.example/": { text: PAGE, finalUrl: "https://parked-domains.example/" } });
    expect(await findCompanyImagery({ website: "https://acme.example", verifiedUrls: ["https://acme.example/"] }, fetcher)).toEqual([]);
  });
});

describe("links in research write-ups", () => {
  it("finds markdown and bare links and trims trailing punctuation", async () => {
    const { linksInText } = await import("@/lib/research/links");
    const text = "Acme raised a seed round ([Sifted](https://sifted.eu/articles/acme-seed)). See https://acme.example/investors. Also (https://www.ox.ac.uk/news/acme)!";
    expect(linksInText(text)).toEqual(["https://sifted.eu/articles/acme-seed", "https://acme.example/investors", "https://www.ox.ac.uk/news/acme"]);
  });
});
