// Render public/icons/icon.svg to the PNG sizes the manifest and iOS need.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const svg = readFileSync("public/icons/icon.svg", "utf8");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
for (const [file, size] of [["public/icons/icon-192.png", 192], ["public/icons/icon-512.png", 512], ["public/icons/apple-touch-icon.png", 180]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: file, omitBackground: true });
  await page.close();
  console.log("wrote", file);
}
await browser.close();
