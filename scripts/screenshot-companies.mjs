#!/usr/bin/env node
/**
 * Free homepage screenshots for companies without a usable photo. Opens each
 * company's own website in headless Chromium, clears cookie banners and
 * pop-ups, and saves the top of the page as public/company-shots/<domain>.webp
 * (1200x750). public/company-shots/index.json lists what was taken and when;
 * the app shows these when a company has no photo of its own.
 *
 *   node scripts/screenshot-companies.mjs companies.json
 *
 * companies.json: [{ "name": "...", "domain": "example.co.uk" }, ...]
 * Review the results by eye before committing: delete any file that shows an
 * error page, a login wall or a blank page, and rerun.
 */
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const list = JSON.parse(readFileSync(process.argv[2], "utf8"));
const outDir = "public/company-shots";
mkdirSync(outDir, { recursive: true });
const indexFile = path.join(outDir, "index.json");
const index = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, "utf8")) : {};

const DISMISS = /^(accept( all)?( cookies)?|allow( all)?( cookies)?|agree|i agree|got it|ok|okay|close|no thanks|decline|reject( all)?|continue|dismiss|×|x)$/i;

async function clearOverlays(page) {
  for (let round = 0; round < 3; round++) {
    const buttons = page.locator("button, a[role=button], [role=button], input[type=button]");
    const n = Math.min(await buttons.count(), 80);
    for (let i = 0; i < n; i++) {
      const b = buttons.nth(i);
      const label = ((await b.innerText().catch(() => "")) || (await b.getAttribute("aria-label").catch(() => "")) || "").trim();
      if (DISMISS.test(label) && (await b.isVisible().catch(() => false))) await b.click({ timeout: 1500 }).catch(() => {});
    }
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(400);
  }
  await page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight;
    for (const el of document.querySelectorAll("body *")) {
      const s = getComputedStyle(el);
      if (s.position !== "fixed" && s.position !== "sticky") continue;
      const r = el.getBoundingClientRect();
      const hint = `${el.id} ${el.className}`.toLowerCase();
      const big = r.width * r.height > vw * vh * 0.15;
      const nav = r.top <= 2 && r.height < 140 && !/cookie|consent|banner|popup|modal|newsletter|gdpr/.test(hint);
      if (nav) continue;
      if (big || /cookie|consent|popup|modal|newsletter|gdpr|chat|intercom|hubspot|drift|overlay|backdrop/.test(hint) || r.bottom >= vh - 2) el.remove();
    }
    document.documentElement.style.overflow = "auto";
    document.body.style.overflow = "auto";
  });
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
const queue = [...list];
async function worker() {
  while (queue.length) {
    const c = queue.shift();
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "en-GB", userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36" });
    const page = await context.newPage();
    try {
      await page.goto(`https://${c.domain}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(1500);
      await clearOverlays(page);
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(500);
      const png = await page.screenshot({ type: "png" });
      const file = `${c.domain.replace(/[^a-z0-9.-]/gi, "_")}.webp`;
      await sharp(png).resize(1200, 750).webp({ quality: 72 }).toFile(path.join(outDir, file));
      index[c.domain] = { file, takenAt: new Date().toISOString().slice(0, 10), url: page.url() };
      console.log("ok  ", c.domain);
    } catch (e) {
      console.log("FAIL", c.domain, String(e.message).split("\n")[0].slice(0, 120));
    }
    await context.close();
  }
}
await Promise.all([worker(), worker(), worker(), worker()]);
await browser.close();
writeFileSync(indexFile, JSON.stringify(Object.fromEntries(Object.entries(index).sort()), null, 1) + "\n");
