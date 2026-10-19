#!/usr/bin/env node
/**
 * Capture reference screenshots of the running app at phone, iPad and desktop widths.
 * Usage: node scripts/screenshot.mjs [baseUrl] [outDir] [paths...]
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:3000";
const outDir = process.argv[3] ?? "docs/screenshots";
const paths = process.argv.slice(4).length ? process.argv.slice(4) : ["/", "/discover", "/companies/larkspur-photonics", "/companies/larkspur-photonics?tab=analysis", "/companies/larkspur-photonics?tab=funding", "/companies/larkspur-photonics?tab=team", "/companies/larkspur-photonics?tab=updates", "/companies/larkspur-photonics?tab=family", "/companies/larkspur-photonics?tab=sources", "/shortlist", "/updates", "/more", "/research/settings", "/events", "/networks"];
const viewports = [
  { name: "phone-390", width: 390, height: 844, mobile: true },
  { name: "ipad-820", width: 820, height: 1180, mobile: true },
  { name: "desktop-1440", width: 1440, height: 900, mobile: false },
];

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
for (const vp of viewports) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: Number(process.env.SCALE ?? 2), isMobile: vp.mobile, hasTouch: vp.mobile });
  const page = await context.newPage();
  for (const p of paths) {
    const file = path.join(outDir, `${vp.name}${p === "/" ? "-home" : "-" + p.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}.png`);
    await page.goto(base + p, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    await page.screenshot({ path: file, fullPage: !process.env.VIEWPORT_ONLY });
    console.log("saved", file);
  }
  await context.close();
}
await browser.close();
