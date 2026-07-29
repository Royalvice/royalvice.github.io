#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright";

const root = process.cwd();
const baseUrl = process.env.PROFILE_ROOM_URL || "http://127.0.0.1:4173";
const output = path.join(root, "artifacts/profile-room-v3-review/2026-07-17-living-r1/browser");
await fs.mkdir(output, { recursive: true });

async function encodeWebp(page, input, destinations) {
  const encoded = (await fs.readFile(input)).toString("base64");
  const bytes = await page.evaluate(async (source) => {
    const image = new Image();
    image.src = `data:image/png;base64,${source}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext("2d").drawImage(image, 0, 0);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error("WebP poster encoding failed.")), "image/webp", 0.92);
    });
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }, encoded);
  for (const destination of destinations) {
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, Buffer.from(bytes));
  }
}

async function captureRoomCanvas(page, destination) {
  // Capture the authoritative internal pixel buffer. Playwright's element
  // screenshot waits for visual stability, which an autonomous Canvas room is
  // deliberately never able to reach.
  const source = await page.locator(".profile-sprite-canvas").evaluate((canvas) => canvas.toDataURL("image/png"));
  await fs.writeFile(destination, Buffer.from(source.slice(source.indexOf(",") + 1), "base64"));
}

async function describePoster(file, url, size) {
  const bytes = await fs.readFile(file);
  return {
    url,
    size,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.byteLength
  };
}

async function waitForRoom(page) {
  // The gallery intentionally keeps video/asset requests alive, so networkidle
  // is not a meaningful readiness signal for the independent Canvas room.
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => window.__profileAdventureDebug?.getState().ready === true, null, { timeout: 60_000 });
}

const browser = await chromium.launch({ headless: true });
const errors = [];
const states = {};
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
page.on("pageerror", (error) => errors.push(String(error)));
await waitForRoom(page);
for (const [label, seconds] of [
  ["autonomous-start", 0.5],
  ["tv-gaming", 2],
  ["blackboard-thinking", 5],
  ["water-cooler", 9.75],
  ["two-seat-sofa", 21.75],
  ["door-entering", 24],
  ["door-away", 25],
  ["door-returning", 28.75]
]) {
  await page.evaluate((time) => window.__profileAdventureDebug.setTime(time), seconds);
  states[label] = await page.evaluate(() => window.__profileAdventureDebug.getState());
  await captureRoomCanvas(page, path.join(output, `${label}.png`));
  console.log(`captured ${label}`);
}
await page.evaluate(() => window.__profileAdventureDebug.setTime(0));
await page.locator('[data-profile-actor="nobita"]').focus();
await page.waitForTimeout(80);
await captureRoomCanvas(page, path.join(output, "keyboard-ground-focus.png"));
console.log("captured keyboard-ground-focus");
await page.close();

const posterTargets = {
  desktop: [
    path.join(root, "public/assets/profile/adventure/room-v3/posters/profile-room-v3-fallback-desktop.webp"),
    path.join(root, "public/assets/profile/adventure/posters/profile-adventure-fallback-desktop.webp")
  ],
  mobile: [
    path.join(root, "public/assets/profile/adventure/room-v3/posters/profile-room-v3-fallback-mobile.webp"),
    path.join(root, "public/assets/profile/adventure/posters/profile-adventure-fallback-mobile.webp")
  ]
};

const reducedDesktop = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
await waitForRoom(reducedDesktop);
const desktopSource = path.join(output, "fallback-desktop-source.png");
await captureRoomCanvas(reducedDesktop, desktopSource);
await encodeWebp(reducedDesktop, desktopSource, posterTargets.desktop);
console.log("captured fallback-desktop-source");
const desktopLayout = await reducedDesktop.evaluate(() => ({
  viewport: [innerWidth, innerHeight],
  scrollWidth: document.documentElement.scrollWidth,
  stage: (() => { const rect = document.querySelector(".profile-adventure-stage").getBoundingClientRect(); return [rect.x, rect.y, rect.width, rect.height]; })(),
  state: window.__profileAdventureDebug.getState()
}));
await reducedDesktop.close();

const reducedMobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
await waitForRoom(reducedMobile);
const mobileSource = path.join(output, "fallback-mobile-source.png");
await captureRoomCanvas(reducedMobile, mobileSource);
await fs.copyFile(mobileSource, path.join(output, "mobile-390x844.png"));
await encodeWebp(reducedMobile, mobileSource, posterTargets.mobile);
console.log("captured fallback-mobile-source");
const mobileLayout = await reducedMobile.evaluate(() => ({
  viewport: [innerWidth, innerHeight],
  scrollWidth: document.documentElement.scrollWidth,
  stage: (() => { const rect = document.querySelector(".profile-adventure-stage").getBoundingClientRect(); return [rect.x, rect.y, rect.width, rect.height]; })(),
  state: window.__profileAdventureDebug.getState()
}));
await reducedMobile.close();

const manifestPath = path.join(root, "public/assets/profile/adventure/room-v3/profile-room-v3-manifest.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
manifest.fallbacks = {
  desktop: await describePoster(posterTargets.desktop[0], "/assets/profile/adventure/room-v3/posters/profile-room-v3-fallback-desktop.webp", [640, 320]),
  mobile: await describePoster(posterTargets.mobile[0], "/assets/profile/adventure/room-v3/posters/profile-room-v3-fallback-mobile.webp", [320, 352])
};
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

await fs.writeFile(path.join(output, "result.json"), `${JSON.stringify({ states, desktopLayout, mobileLayout, errors }, null, 2)}\n`);
console.log(JSON.stringify({ desktopLayout, mobileLayout, errors, output }, null, 2));
await browser.close();
