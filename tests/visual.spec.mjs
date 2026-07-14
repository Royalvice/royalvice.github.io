import { mkdir, writeFile } from "node:fs/promises";
import { test, expect } from "playwright/test";

const out = "/tmp/royalvice-visual";

async function captureViewport(page, filename) {
  const cdp = await page.context().newCDPSession(page);
  const frame = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false
  });
  await writeFile(`${out}/${filename}`, Buffer.from(frame.data, "base64"));
}

test("capture the three desktop chapters", async ({ page }) => {
  test.setTimeout(180_000);
  await mkdir(out, { recursive: true });
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/", { waitUntil: "networkidle" });
  await page.locator(".terminal-shell").dispatchEvent("mouseenter");
  await page.waitForTimeout(6_000);
  await page.locator(".terminal-shell").dispatchEvent("mouseleave");
  await page.waitForTimeout(120);
  for (const [id, name] of [["profile", "01-profile.png"], ["voyage", "02-voyage.png"], ["horizon", "03-horizon.png"]]) {
    const top = await page.locator(`#${id}`).evaluate((element) => element.offsetTop);
    await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
    if (id === "horizon") {
      await page.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 30_000 });
      await page.evaluate(() => window.__horizonDebug.setTime(12));
      await page.waitForTimeout(2_800);
    } else await page.waitForTimeout(1_200);
    await captureViewport(page, name);
    if (id === "profile") {
      await page.locator(".godot-status").hover();
      await page.waitForTimeout(350);
      await captureViewport(page, "profile-godot-fire.png");
      await page.mouse.move(1, 1);
      await page.locator(".siggraph-lever").dispatchEvent("click");
      await expect(page.locator("[data-siggraph-machine]")).toHaveAttribute("data-result", "2", { timeout: 15_000 });
      await page.waitForTimeout(1_200);
      await captureViewport(page, "profile-siggraph-payout.png");
    }
    if (id === "horizon") {
      await page.evaluate(() => window.__horizonDebug.triggerMeteor("single"));
      await expect.poll(() => page.evaluate(() => window.__horizonDebug().meteorCount)).toBe(1);
      await page.waitForTimeout(260);
      await captureViewport(page, "horizon-meteor-single.png");
      await page.evaluate(() => window.__horizonDebug.triggerMeteor("triple"));
      await expect.poll(() => page.evaluate(() => window.__horizonDebug().meteorCount)).toBe(3);
      await page.waitForTimeout(360);
      await captureViewport(page, "horizon-meteor-triple.png");
    }
  }
  expect(errors).toEqual([]);
});

test("capture mobile profile and verify no horizontal overflow", async ({ browser }) => {
  await mkdir(out, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
  await page.waitForTimeout(2_000);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await captureViewport(page, "mobile-profile.png");
  await context.close();
});

test("capture Horizon responsive, reduced-motion, fallback, and transition frames", async ({ browser }) => {
  test.setTimeout(180_000);
  await mkdir(out, { recursive: true });
  for (const [filename, viewport] of [
    ["horizon-1440x900.png", { width: 1440, height: 900 }],
    ["horizon-1280x800.png", { width: 1280, height: 800 }],
    ["horizon-390x844.png", { width: 390, height: 844 }]
  ]) {
    const context = await browser.newContext({ viewport, colorScheme: "dark" });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
    const top = await page.locator("#horizon").evaluate((element) => element.offsetTop);
    await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
    await page.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 30_000 });
    await page.evaluate(() => window.__horizonDebug.setTime(12));
    await page.waitForTimeout(2_800);
    await captureViewport(page, filename);
    await context.close();
  }

  const reduced = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "dark", reducedMotion: "reduce" });
  const reducedPage = await reduced.newPage();
  await reducedPage.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
  const reducedTop = await reducedPage.locator("#horizon").evaluate((element) => element.offsetTop);
  await reducedPage.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), reducedTop);
  await reducedPage.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 30_000 });
  await captureViewport(reducedPage, "horizon-reduced.png");
  await reduced.close();

  const fallback = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "dark" });
  await fallback.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (type === "webgl2") return null;
      return original.call(this, type, ...args);
    };
  });
  const fallbackPage = await fallback.newPage();
  await fallbackPage.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
  const fallbackTop = await fallbackPage.locator("#horizon").evaluate((element) => element.offsetTop);
  await fallbackPage.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), fallbackTop);
  await fallbackPage.waitForTimeout(2_800);
  await captureViewport(fallbackPage, "horizon-fallback.png");
  await fallback.close();

  const ufoFallback = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "dark" });
  const ufoFallbackPage = await ufoFallback.newPage();
  await ufoFallbackPage.route("**/ufo-atlas.png", (route) => route.abort("failed"));
  await ufoFallbackPage.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  const ufoFallbackTop = await ufoFallbackPage.locator("#horizon").evaluate((element) => element.offsetTop);
  await ufoFallbackPage.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), ufoFallbackTop);
  await ufoFallbackPage.waitForFunction(() => window.__horizonDebug?.().ready && !window.__horizonDebug().ufoAtlasReady, null, { timeout: 30_000 });
  await captureViewport(ufoFallbackPage, "horizon-ufo-atlas-fallback.png");
  await ufoFallback.close();

  const transition = await browser.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: "dark" });
  const transitionPage = await transition.newPage();
  await transitionPage.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
  await transitionPage.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 30_000 });
  const horizonTop = await transitionPage.locator("#horizon").evaluate((element) => element.offsetTop);
  for (const [filename, ratio] of [["transition-start.png", .86], ["transition-mid.png", .53], ["transition-end.png", .20]]) {
    await transitionPage.evaluate(({ top, viewportRatio }) => scrollTo({ top: top - innerHeight * viewportRatio, behavior: "instant" }), { top: horizonTop, viewportRatio: ratio });
    await transitionPage.waitForTimeout(280);
    await captureViewport(transitionPage, filename);
  }
  await transition.close();
});

test("capture Moonlit OASIS celebration loop keyframes", async ({ browser }) => {
  test.setTimeout(180_000);
  await mkdir(out, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: "dark" });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
  const top = await page.locator("#horizon").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 30_000 });
  await page.waitForFunction(() => window.__horizonDebug?.().ufoAtlasReady, null, { timeout: 30_000 });
  await page.evaluate(() => window.__horizonDebug.setTime(12));
  await captureViewport(page, "horizon-moon-road-and-wave-glints-1920x1080.png");
  await page.evaluate(() => window.__horizonDebug.triggerFirework("cinematic"));
  await page.waitForTimeout(650);
  await captureViewport(page, "horizon-firework-main-burst-1920x1080.png");
  await page.waitForTimeout(1550);
  await captureViewport(page, "horizon-firework-embers-reflection-1920x1080.png");
  for (const [seconds, filename] of [
    [38.35, "horizon-ufo-emerging-1920x1080.png"],
    [40.35, "horizon-beam-abducting-1920x1080.png"],
    [42.35, "horizon-ufo-returning-1920x1080.png"],
    [44.20, "horizon-boat-respawning-1920x1080.png"]
  ]) {
    await page.evaluate((value) => window.__horizonDebug.setTime(value), seconds);
    await captureViewport(page, filename);
  }
  expect(errors).toEqual([]);
  await context.close();
});
