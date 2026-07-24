#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, request } from "playwright";

const baseUrl = (process.env.PROFILE_ROOM_URL || "http://127.0.0.1:4173").replace(/\/$/, "");
const output = path.resolve(process.env.PROFILE_ROOM_OUTPUT || "/tmp/royalvice-profile-verification");
const actors = ["nobita", "doraemon", "shizuka", "gian", "suneo"];
const movementActors = ["doraemon", "shizuka", "gian", "suneo"];
const apiProxy = process.env.PROFILE_ROOM_PROXY ? { server: process.env.PROFILE_ROOM_PROXY } : undefined;
const browserProxy = process.env.PROFILE_ROOM_BROWSER_PROXY ? { server: process.env.PROFILE_ROOM_BROWSER_PROXY } : undefined;

await mkdir(output, { recursive: true });

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const apiContexts = [];

async function apiGet(url) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const api = await request.newContext({ proxy: apiProxy });
    try {
      const response = await api.get(url, { timeout: 60_000, headers: { "cache-control": "no-cache" } });
      if (!response.ok()) throw new Error(`${url} returned ${response.status()}`);
      apiContexts.push(api);
      return response;
    } catch (error) {
      await api.dispose();
      lastError = error;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    }
  }
  throw lastError;
}

const cacheBust = `verify=${Date.now()}`;
const manifestUrl = `${baseUrl}/assets/profile/adventure/room-v4/profile-room-v4-manifest.json?${cacheBust}`;
const manifestResponse = await apiGet(manifestUrl);
const manifest = await manifestResponse.json();
const atlasChecks = {};
for (const actor of movementActors) {
  const movement = manifest.actors?.[actor]?.movement;
  if (!movement) throw new Error(`Manifest movement entry missing for ${actor}`);
  const response = await apiGet(`${baseUrl}${movement.url}?${cacheBust}`);
  const bytes = await response.body();
  const actualSha256 = sha256(bytes);
  atlasChecks[actor] = {
    url: movement.url,
    status: response.status(),
    bytes: bytes.byteLength,
    sha256: actualSha256,
    expectedBytes: movement.bytes,
    expectedSha256: movement.sha256,
  };
  if (bytes.byteLength !== movement.bytes || actualSha256 !== movement.sha256) {
    throw new Error(`Atlas integrity mismatch for ${actor}`);
  }
}
await Promise.all(apiContexts.map((api) => api.dispose()));

const browser = await chromium.launch({ headless: true, proxy: browserProxy });
const browserChecks = {};

async function verifyViewport(name, viewport) {
  const context = await browser.newContext({ viewport, colorScheme: "dark", deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const ignoredAbortedMedia = [];
  const externalFailures = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    const failure = { url: request.url(), error: request.failure()?.errorText || "unknown" };
    if (failure.error === "net::ERR_ABORTED" && /\.(?:mp4|webm)(?:\?|$)/i.test(failure.url)) ignoredAbortedMedia.push(failure);
    else if (new URL(failure.url).origin !== new URL(baseUrl).origin) externalFailures.push(failure);
    else failedRequests.push(failure);
  });

  let navigationError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      await page.goto(`${baseUrl}/?${cacheBust}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      navigationError = undefined;
      break;
    } catch (error) {
      navigationError = error;
      if (attempt < 4) await page.waitForTimeout(attempt * 750);
    }
  }
  if (navigationError) throw navigationError;
  let networkIdleReached = true;
  try {
    await page.waitForLoadState("networkidle", { timeout: 15_000 });
  } catch {
    // The Gallery intentionally streams optional media and model upgrades.
    // Record a busy network, but gate Profile on its own deterministic hook.
    networkIdleReached = false;
  }
  await page.waitForFunction(() => window.__profileAdventureDebug?.getState().ready === true, null, { timeout: 60_000 });
  await page.evaluate(() => {
    window.__profileAdventureDebug.setTime(2);
    window.__profileAdventureDebug.pause();
  });
  await page.waitForTimeout(180);
  const state = await page.evaluate(() => window.__profileAdventureDebug.getState());
  const actorStates = Object.fromEntries(actors.map((actor) => [actor, {
    asset: state.assets.actors[actor],
    frame: state.actorFrames[actor],
    renderInstanceCount: state.actors[actor].renderInstanceCount,
  }]));
  if (!actors.every((actor) => actorStates[actor].asset === "ready" && actorStates[actor].renderInstanceCount === 1)) {
    throw new Error(`${name} actor readiness failed: ${JSON.stringify(actorStates)}`);
  }

  await page.locator(".profile-adventure-stage").evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(output, `${name}-profile-room.png`), animations: "disabled" });
  const canvasData = await page.locator(".profile-sprite-canvas").evaluate((canvas) => canvas.toDataURL("image/png"));
  await writeFile(path.join(output, `${name}-profile-room-canvas.png`), Buffer.from(canvasData.slice(canvasData.indexOf(",") + 1), "base64"));
  const layout = await page.evaluate(() => ({
    viewport: [innerWidth, innerHeight],
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    room: (() => {
      const rect = document.querySelector(".profile-adventure-stage").getBoundingClientRect();
      return [rect.left, rect.top, rect.right, rect.bottom];
    })(),
  }));
  if (layout.scrollWidth !== layout.clientWidth) throw new Error(`${name} has horizontal overflow`);
  const actionableConsoleErrors = externalFailures.length
    ? consoleErrors.filter((message) => !message.startsWith("Failed to load resource:"))
    : consoleErrors;
  if (actionableConsoleErrors.length || pageErrors.length || failedRequests.length) {
    throw new Error(`${name} browser errors: ${JSON.stringify({ consoleErrors, pageErrors, failedRequests, externalFailures })}`);
  }
  browserChecks[name] = { networkIdleReached, actorStates, assets: state.assets, layout, consoleErrors, actionableConsoleErrors, pageErrors, failedRequests, externalFailures, ignoredAbortedMedia };
  await context.close();
}

try {
  await verifyViewport("desktop-1920x1080", { width: 1920, height: 1080 });
  await verifyViewport("mobile-390x844", { width: 390, height: 844 });
} finally {
  await browser.close();
}

const result = {
  baseUrl,
  manifest: { url: manifestUrl, version: manifest.version },
  atlasChecks,
  browserChecks,
  screenshots: {
    desktop: path.join(output, "desktop-1920x1080-profile-room.png"),
    desktopCanvas: path.join(output, "desktop-1920x1080-profile-room-canvas.png"),
    mobile: path.join(output, "mobile-390x844-profile-room.png"),
    mobileCanvas: path.join(output, "mobile-390x844-profile-room-canvas.png"),
  },
};
await writeFile(path.join(output, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
