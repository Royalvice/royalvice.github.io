#!/usr/bin/env node
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const baseUrl = process.env.PROFILE_ROOM_URL || "http://127.0.0.1:4173";
const output = path.join(root, "artifacts/profile-room-v3-review/2026-07-17-living-r1/browser");
await fs.mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  reducedMotion: "reduce"
});
const page = await context.newPage();
const errors = [];
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", (error) => errors.push(String(error)));
await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForFunction(() => window.__profileAdventureDebug?.getState().ready === true, null, { timeout: 60_000 });

const png = path.join(output, "fallback-mobile-source.png");
const source = await page.locator(".profile-sprite-canvas").evaluate((canvas) => canvas.toDataURL("image/png"));
await fs.writeFile(png, Buffer.from(source.slice(source.indexOf(",") + 1), "base64"));
await fs.copyFile(png, path.join(output, "mobile-390x844.png"));

const encoded = (await fs.readFile(png)).toString("base64");
const bytes = await page.evaluate(async (imageSource) => {
  const image = new Image();
  image.src = `data:image/png;base64,${imageSource}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext("2d").drawImage(image, 0, 0);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("WebP encoding failed.")), "image/webp", 0.92);
  });
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}, encoded);
const webp = Buffer.from(bytes);
const targets = [
  path.join(root, "public/assets/profile/adventure/room-v3/posters/profile-room-v3-fallback-mobile.webp"),
  path.join(root, "public/assets/profile/adventure/posters/profile-adventure-fallback-mobile.webp")
];
for (const target of targets) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, webp);
}

const manifestPath = path.join(root, "public/assets/profile/adventure/room-v3/profile-room-v3-manifest.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
manifest.fallbacks ||= {};
manifest.fallbacks.mobile = {
  url: "/assets/profile/adventure/room-v3/posters/profile-room-v3-fallback-mobile.webp",
  size: [320, 352],
  sha256: createHash("sha256").update(webp).digest("hex"),
  bytes: webp.byteLength
};
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const result = await page.evaluate(() => ({
  state: window.__profileAdventureDebug.getState(),
  viewport: [innerWidth, innerHeight],
  scrollWidth: document.documentElement.scrollWidth,
  stage: (() => { const rect = document.querySelector(".profile-adventure-stage").getBoundingClientRect(); return [rect.x, rect.y, rect.width, rect.height]; })()
}));
console.log(JSON.stringify({ ...result, errors, output }, null, 2));
await context.close();
await browser.close();
