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

async function captureRoomCanvas(page, filename) {
  const dataUrl = await page.locator(".profile-sprite-canvas").evaluate((canvas) => canvas.toDataURL("image/png"));
  await writeFile(`${out}/${filename}`, Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"));
}

async function scrollRoomIntoView(page) {
  await page.locator(".profile-adventure-stage").evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
}

test("capture the three desktop chapters", async ({ page }) => {
  test.setTimeout(600_000);
  await mkdir(out, { recursive: true });
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Zongyuan Yang" }).waitFor();
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
    } else if (id === "voyage") {
      await page.waitForFunction(() => window.__voyageDebug?.().ready, null, { timeout: 60_000 });
      await page.evaluate(() => window.__voyageDebug.setIntroTime(5.2));
      await page.waitForTimeout(8_000);
    } else {
      await page.waitForFunction(() => window.__profileAdventureDebug?.getState().ready, null, { timeout: 60_000 });
      await page.evaluate(() => window.__profileAdventureDebug.setTime(2));
      await page.waitForTimeout(180);
    }
    await captureViewport(page, name);
    if (id === "profile") {
      for (const [time, filename] of [
        [.5, "profile-room-v3-autonomous-start.png"],
        [2, "profile-room-v3-tv-gaming.png"],
        [5, "profile-room-v3-blackboard-thinking.png"],
        [9.75, "profile-room-v3-water-cooler.png"],
        [21.75, "profile-room-v3-two-seat-sofa.png"],
        [24, "profile-room-v3-door-entering.png"],
        [25, "profile-room-v3-door-away.png"],
        [28.75, "profile-room-v3-door-returning.png"]
      ]) {
        await page.evaluate((value) => window.__profileAdventureDebug.setTime(value), time);
        await page.waitForTimeout(160);
        await captureViewport(page, filename);
      }
      const roomAssets = (await page.evaluate(() => window.__profileAdventureDebug.getState())).assets;
      expect(Object.values(roomAssets.actors)).toEqual(["ready", "ready", "ready", "ready", "ready"]);
      expect([roomAssets.furniture, roomAssets.door, roomAssets.lamps, roomAssets.posters]).toEqual(["ready", "ready", "ready", "ready"]);
      await page.locator(".godot-status").hover();
      await page.waitForTimeout(350);
      await captureViewport(page, "profile-godot-fire.png");
      await page.mouse.move(1, 1);
      await page.locator(".siggraph-lever").dispatchEvent("click");
      await expect(page.locator("[data-siggraph-machine]")).toHaveAttribute("data-result", "3", { timeout: 15_000 });
      await page.waitForTimeout(1_200);
      await captureViewport(page, "profile-siggraph-payout.png");
    }
    if (id === "horizon") {
      await page.evaluate(() => window.__horizonDebug.triggerMeteor("single"));
      await expect.poll(() => page.evaluate(() => window.__horizonDebug().meteorCount)).toBe(1);
      await page.waitForTimeout(260);
      await captureViewport(page, "horizon-meteor-single.png");
      await page.evaluate(() => window.__horizonDebug.triggerMeteor("shower"));
      await expect.poll(() => page.evaluate(() => window.__horizonDebug().meteorCount)).toBe(8);
      await page.waitForTimeout(620);
      await captureViewport(page, "horizon-meteor-shower.png");
    }
  }
  expect(errors).toEqual([]);
});

test("capture THE LUMINOUS WAKE cinematic, journal, evidence, responsive, and fallback frames", async ({ browser }) => {
  test.setTimeout(480_000);
  await mkdir(out, { recursive: true });
  const desktop = await browser.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: "dark" });
  const page = await desktop.newPage();
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  const voyageTop = await page.locator("#voyage").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), voyageTop);
  await page.waitForFunction(() => window.__voyageDebug?.().ready, null, { timeout: 60_000 });
  await page.waitForFunction(() => Object.values(window.__voyageDebug().landmarkAssets).every((state) => state === "v3-lod"), null, { timeout: 90_000 });
  await page.waitForFunction(() => window.__voyageDebug().assetsReady, null, { timeout: 90_000 });
  for (const [time, filename] of [[.8, "voyage-intro-dissolve-0.8s-1920x1080.png"], [2.8, "voyage-intro-route-2.8s-1920x1080.png"], [5.2, "voyage-interactive-eva01-1920x1080.png"]]) {
    await page.evaluate((value) => {
      window.__voyageDebug.setIntroTime(value);
      window.__voyageDebug.setSceneTime(value === 5.2 ? 0 : value);
    }, time);
    if (time === 5.2) await page.waitForTimeout(650);
    await captureViewport(page, filename);
  }
  await page.evaluate(() => window.__voyageDebug.setSceneTime(2.25));
  await captureViewport(page, "voyage-ocean-negative-space-long-swell-1920x1080.png");
  for (const [time, filename] of [
    [0, "voyage-cycle-morning-sun-road-1920x1080.png"],
    [18, "voyage-cycle-noon-white-gold-glints-1920x1080.png"],
    [34, "voyage-cycle-sunset-long-shadows-1920x1080.png"],
    [45, "voyage-cycle-night-moon-road-lighthouse-1920x1080.png"],
    [56, "voyage-cycle-dawn-return-1920x1080.png"]
  ]) {
    await page.evaluate((value) => window.__voyageDebug.setSceneTime(value), time);
    await page.waitForTimeout(160);
    await captureViewport(page, filename);
  }
  for (const [time, filename] of [
    [1.387, "voyage-glint-continuity-before-1920x1080.png"],
    [1.391, "voyage-glint-continuity-after-1920x1080.png"]
  ]) {
    await page.evaluate((value) => window.__voyageDebug.setSceneTime(value), time);
    await page.waitForTimeout(80);
    await captureViewport(page, filename);
  }
  await page.evaluate(() => {
    window.__voyageDebug.selectNode("world");
    window.__voyageDebug.setSceneTime(45);
  });
  await page.waitForTimeout(180);
  await captureViewport(page, "voyage-night-oasis-ghost-1920x1080.png");
  await page.evaluate(() => window.__voyageDebug.selectNode("eva01"));
  await page.evaluate(() => window.__voyageDebug.setSceneTime(0));
  await captureViewport(page, "voyage-overhead-74deg-floating-archipelago-1920x1080.png");
  await captureViewport(page, "voyage-boat-harbor-differential-buoyancy-1920x1080.png");
  await captureViewport(page, "voyage-spectral-caustic-route-1920x1080.png");
  for (const [node, filename] of [
    ["docdiff", "voyage-node-00-dock-1920x1080.png"],
    ["neural", "voyage-node-01-prism-1920x1080.png"],
    ["directl", "voyage-node-02-lightfield-1920x1080.png"],
    ["eva01", "voyage-node-03-native-1920x1080.png"],
    ["world", "voyage-node-04-oasis-1920x1080.png"]
  ]) {
    await page.evaluate((value) => window.__voyageDebug.selectNode(value), node);
    await captureViewport(page, filename);
  }
  await page.evaluate(() => window.__voyageDebug.selectNode("eva01"));
  await captureViewport(page, "voyage-evidence-closed-1920x1080.png");
  await page.evaluate(() => window.__voyageDebug.setEvidenceOpen(true));
  await page.waitForTimeout(500);
  await captureViewport(page, "voyage-evidence-open-1920x1080.png");
  expect(errors).toEqual([]);
  await desktop.close();

  for (const [filename, viewport] of [
    ["voyage-1440x900.png", { width: 1440, height: 900 }],
    ["voyage-1280x800.png", { width: 1280, height: 800 }],
    ["voyage-mobile-390x844.png", { width: 390, height: 844 }]
  ]) {
    const context = await browser.newContext({ viewport, colorScheme: "dark" });
    const responsivePage = await context.newPage();
    await responsivePage.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
    const top = await responsivePage.locator("#voyage").evaluate((element) => element.offsetTop);
    await responsivePage.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
    await responsivePage.waitForFunction(() => window.__voyageDebug?.().ready, null, { timeout: 60_000 });
    await responsivePage.evaluate(() => {
      window.__voyageDebug.setIntroTime(5.2);
      window.__voyageDebug.setSceneTime(0);
    });
    await responsivePage.waitForFunction(() => Object.values(window.__voyageDebug().landmarkAssets).every((state) => state === "v3-lod"), null, { timeout: 90_000 });
    await responsivePage.waitForFunction(() => window.__voyageDebug().assetsReady, null, { timeout: 90_000 });
    await captureViewport(responsivePage, filename);
    if (viewport.width === 390) {
      await responsivePage.locator("[data-evidence-toggle]").click();
      await responsivePage.waitForTimeout(450);
      await captureViewport(responsivePage, "voyage-mobile-evidence-390x844.png");
    }
    expect(await responsivePage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    await context.close();
  }

  const reduced = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "dark", reducedMotion: "reduce" });
  const reducedPage = await reduced.newPage();
  await reducedPage.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  const reducedTop = await reducedPage.locator("#voyage").evaluate((element) => element.offsetTop);
  await reducedPage.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), reducedTop);
  await reducedPage.waitForFunction(() => window.__voyageDebug?.().ready, null, { timeout: 60_000 });
  await reducedPage.waitForFunction(() => Object.values(window.__voyageDebug().landmarkAssets).every((state) => state === "v3-lod"), null, { timeout: 90_000 });
  await reducedPage.waitForFunction(() => window.__voyageDebug().assetsReady, null, { timeout: 90_000 });
  await captureViewport(reducedPage, "voyage-reduced-motion.png");
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
  await fallbackPage.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  const fallbackTop = await fallbackPage.locator("#voyage").evaluate((element) => element.offsetTop);
  await fallbackPage.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), fallbackTop);
  await expect(fallbackPage.locator("#voyage")).toHaveClass(/voyage-fallback-active/, { timeout: 60_000 });
  await fallbackPage.waitForFunction(() => document.fonts.status === "loaded" && document.querySelector(".voyage-fallback-art img")?.complete);
  await fallbackPage.waitForTimeout(650);
  await captureViewport(fallbackPage, "voyage-webgl-fallback.png");
  await fallback.close();

  const modelFallback = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "dark" });
  const modelFallbackPage = await modelFallback.newPage();
  await modelFallbackPage.route("**/models/landmarks/v3/lighthouse.glb*", (route) => route.abort("failed"));
  await modelFallbackPage.route("**/models/landmarks/v2/lighthouse.glb*", (route) => route.abort("failed"));
  await modelFallbackPage.route("**/models/landmarks/directl.glb*", (route) => route.abort("failed"));
  await modelFallbackPage.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  const modelTop = await modelFallbackPage.locator("#voyage").evaluate((element) => element.offsetTop);
  await modelFallbackPage.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), modelTop);
  await expect(modelFallbackPage.locator('[data-voyage-node="directl"]')).toHaveAttribute("data-asset-state", "poster", { timeout: 90_000 });
  await modelFallbackPage.waitForFunction(() => window.__voyageDebug?.().assetsReady, null, { timeout: 180_000 });
  await modelFallbackPage.evaluate(() => {
    window.__voyageDebug.setIntroTime(5.2);
    window.__voyageDebug.setSceneTime(0);
  });
  await captureViewport(modelFallbackPage, "voyage-single-landmark-fallback.png");
  await modelFallback.close();

  const reflectionFallback = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "dark" });
  await reflectionFallback.addInitScript(() => { window.__forceVoyageReflectionFailure = true; });
  const reflectionFallbackPage = await reflectionFallback.newPage();
  await reflectionFallbackPage.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  const reflectionTop = await reflectionFallbackPage.locator("#voyage").evaluate((element) => element.offsetTop);
  await reflectionFallbackPage.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), reflectionTop);
  await reflectionFallbackPage.waitForFunction(() => window.__voyageDebug?.().ready && window.__voyageDebug().reflectionMode === "analytic", null, { timeout: 60_000 });
  await reflectionFallbackPage.waitForFunction(() => window.__voyageDebug().assetsReady, null, { timeout: 180_000 });
  await reflectionFallbackPage.evaluate(() => {
    window.__voyageDebug.setIntroTime(5.2);
    window.__voyageDebug.setSceneTime(0);
  });
  await reflectionFallbackPage.waitForTimeout(650);
  await captureViewport(reflectionFallbackPage, "voyage-analytic-reflection-fallback.png");
  await reflectionFallback.close();
});

test("capture mobile profile and verify no horizontal overflow", async ({ browser }) => {
  await mkdir(out, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Zongyuan Yang" }).waitFor();
  await page.waitForFunction(() => window.__profileAdventureDebug?.getState().ready, null, { timeout: 60_000 });
  await page.evaluate(() => window.__profileAdventureDebug.setTime(28.75));
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await captureViewport(page, "mobile-profile.png");
  await page.locator(".profile-adventure-stage").scrollIntoViewIfNeeded();
  await page.waitForTimeout(160);
  await captureViewport(page, "profile-sprite-room-mobile-390x844.png");
  await context.close();
});

test("capture living room TV frames, keyboard ground focus, reduced motion, and local sprite fallbacks", async ({ browser }) => {
  test.setTimeout(300_000);
  await mkdir(out, { recursive: true });
  const desktop = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await desktop.newPage();
  await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__profileAdventureDebug?.getState().ready, null, { timeout: 60_000 });
  await scrollRoomIntoView(page);
  for (const [time, filename] of [[2, "profile-room-v3-tv-frame-a.png"], [3.5, "profile-room-v3-tv-frame-b.png"], [5.5, "profile-room-v3-tv-frame-c.png"]]) {
    await page.evaluate((value) => window.__profileAdventureDebug.setTime(value), time);
    await page.waitForTimeout(100);
    await captureRoomCanvas(page, filename);
  }
  await page.evaluate(() => window.__profileAdventureDebug.setTime(0));
  await page.locator('[data-profile-actor="nobita"]').focus();
  await expect.poll(() => page.evaluate(() => window.__profileAdventureDebug.getState().focusedActor)).toBe("nobita");
  await captureRoomCanvas(page, "profile-room-v3-keyboard-ground-focus.png");
  await desktop.close();

  const reduced = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  const reducedPage = await reduced.newPage();
  await reducedPage.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await reducedPage.waitForFunction(() => window.__profileAdventureDebug?.getState().ready, null, { timeout: 60_000 });
  await scrollRoomIntoView(reducedPage);
  await captureRoomCanvas(reducedPage, "profile-room-v3-reduced-motion.png");
  await reduced.close();

  const fallback = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const fallbackPage = await fallback.newPage();
  for (const route of [
    "**/room-v4/actors/suneo-life-3x3.webp",
    "**/room-v3/furniture/furniture-3x3.webp",
    "**/room-v3/props/anywhere-door-2x1.webp",
    "**/room-v3/props/fuel-lamp-4x1.webp",
    "**/room-v3/posters/*.webp"
  ]) await fallbackPage.route(route, (handler) => handler.abort());
  await fallbackPage.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await fallbackPage.waitForFunction(() => window.__profileAdventureDebug?.getState().ready, null, { timeout: 60_000 });
  await fallbackPage.evaluate(() => {
    window.__profileAdventureDebug.setTime(9.75);
    window.__profileAdventureDebug.setDoorOpen(true);
  });
  await scrollRoomIntoView(fallbackPage);
  await captureRoomCanvas(fallbackPage, "profile-room-v3-local-fallbacks.png");
  await fallback.close();
});

test("capture Pac-Lab television boot, desktop and mobile cabinets, swapped Voyage, and Evidence lightbox", async ({ browser }) => {
  test.setTimeout(300_000);
  await mkdir(out, { recursive: true });
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "dark", reducedMotion: "no-preference" });
  const page = await desktop.newPage();
  await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__profileAdventureDebug?.getState().ready, null, { timeout: 120_000 });
  await page.locator(".profile-adventure-stage").scrollIntoViewIfNeeded();
  await page.locator("[data-profile-tv]").hover();
  await captureViewport(page, "paclab-tv-hover-aligned.png");
  await page.evaluate(() => window.__profileAdventureDebug.setTvPowerPhase("white"));
  await captureViewport(page, "paclab-tv-white-boot.png");
  await page.evaluate(() => window.__profileAdventureDebug.setTvPowerPhase("idle"));
  await page.locator("[data-profile-tv]").click();
  await page.waitForFunction(() => window.__pacLabDebug?.getState().open, null, { timeout: 10_000 });
  await captureViewport(page, "paclab-arcade-desktop.png");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(700);
  await captureViewport(page, "paclab-arcade-playing.png");
  await page.keyboard.press("Escape");

  const voyageTop = await page.locator("#voyage").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), voyageTop);
  await page.waitForFunction(() => window.__voyageDebug?.().ready, null, { timeout: 120_000 });
  await page.evaluate(() => {
    window.__voyageDebug.skipIntro();
    window.__voyageDebug.setSceneTime(18);
  });
  await page.evaluate(() => window.__voyageDebug.setWildlifeScenario("gulls", .5));
  await captureViewport(page, "voyage-wildlife-day-gulls.png");
  await page.evaluate(() => window.__voyageDebug.setWildlifeScenario("dolphins-underwater", .38));
  await captureViewport(page, "voyage-wildlife-dolphins-underwater.png");
  await page.evaluate(() => window.__voyageDebug.setWildlifeScenario("dolphins-breach", .47));
  await captureViewport(page, "voyage-wildlife-dolphins-breach.png");
  await page.evaluate(() => window.__voyageDebug.setWildlifeScenario("whale-underwater", .30));
  await captureViewport(page, "voyage-wildlife-blue-whale-underwater.png");
  await page.evaluate(() => window.__voyageDebug.setWildlifeScenario("whale-breach", .5));
  await captureViewport(page, "voyage-wildlife-blue-whale-apex.png");
  await page.evaluate(() => window.__voyageDebug.setWildlifeScenario("whale-breach", .65));
  await captureViewport(page, "voyage-wildlife-blue-whale-splashdown.png");
  await page.evaluate(() => {
    window.__voyageDebug.setSceneTime(45);
    window.__voyageDebug.setWildlifeScenario("shark-patrol", .5);
  });
  await captureViewport(page, "voyage-wildlife-night-shark-patrol.png");
  await page.evaluate(() => {
    window.__voyageDebug.clearWildlifeScenario();
    window.__voyageDebug.setSceneTime(18);
  });
  await page.locator('[data-voyage-node="neural"]').click();
  await page.waitForTimeout(500);
  await captureViewport(page, "voyage-neural-rendering-reef.png");
  await page.locator('[data-project-card="ssat"] [data-evidence-zoom]').click();
  await captureViewport(page, "evidence-lightbox-ssat.png");
  await desktop.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark", reducedMotion: "reduce" });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await mobilePage.waitForFunction(() => window.__profileAdventureDebug?.getState().ready, null, { timeout: 120_000 });
  await mobilePage.locator("[data-profile-tv]").click();
  await mobilePage.waitForFunction(() => window.__pacLabDebug?.getState().open, null, { timeout: 10_000 });
  await captureViewport(mobilePage, "paclab-arcade-mobile-390x844.png");
  expect(await mobilePage.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await mobile.close();

  const mobileWildlife = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark", reducedMotion: "no-preference" });
  const mobileWildlifePage = await mobileWildlife.newPage();
  await mobileWildlifePage.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  const mobileVoyageTop = await mobileWildlifePage.locator("#voyage").evaluate((element) => element.offsetTop);
  await mobileWildlifePage.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), mobileVoyageTop);
  await mobileWildlifePage.waitForFunction(() => window.__voyageDebug?.().ready, null, { timeout: 120_000 });
  await mobileWildlifePage.evaluate(() => {
    window.__voyageDebug.setIntroTime(5.2);
    window.__voyageDebug.setSceneTime(18);
    window.__voyageDebug.setWildlifeScenario("dolphins-breach", .47);
  });
  await captureViewport(mobileWildlifePage, "voyage-wildlife-mobile-day-390x844.png");
  await mobileWildlifePage.evaluate(() => {
    window.__voyageDebug.setSceneTime(45);
    window.__voyageDebug.setWildlifeScenario("shark-patrol", .30);
  });
  await captureViewport(mobileWildlifePage, "voyage-wildlife-mobile-night-390x844.png");
  expect(await mobileWildlifePage.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await mobileWildlife.close();
});

test("capture Horizon responsive, reduced-motion, fallback, and transition frames", async ({ browser }) => {
  test.setTimeout(360_000);
  await mkdir(out, { recursive: true });
  for (const [filename, viewport] of [
    ["horizon-1440x900.png", { width: 1440, height: 900 }],
    ["horizon-1280x800.png", { width: 1280, height: 800 }],
    ["horizon-390x844.png", { width: 390, height: 844 }]
  ]) {
    const context = await browser.newContext({ viewport, colorScheme: "dark" });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
    const top = await page.locator("#horizon").evaluate((element) => element.offsetTop);
    await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
    await page.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 30_000 });
    await page.evaluate(() => window.__horizonDebug.setTime(12));
    await page.waitForTimeout(2_800);
    await captureViewport(page, filename);
    if (filename === "horizon-390x844.png") {
      await page.waitForFunction(() => window.__horizonDebug?.().ufoAtlasReady, null, { timeout: 30_000 });
      await page.evaluate(() => window.__horizonDebug.triggerFirework("cinematic"));
      await page.waitForTimeout(950);
      await captureViewport(page, "horizon-firework-mobile-390x844.png");
      await page.evaluate(() => window.__horizonDebug.setTime(40.52));
      await captureViewport(page, "horizon-ufo-beam-mobile-390x844.png");
    }
    await context.close();
  }

  const reduced = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "dark", reducedMotion: "reduce" });
  const reducedPage = await reduced.newPage();
  await reducedPage.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
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
  await fallbackPage.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
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
  await transitionPage.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  const horizonTop = await transitionPage.locator("#horizon").evaluate((element) => element.offsetTop);
  // Horizon is visibility-hydrated; bring the transition boundary into the
  // viewport before waiting for its debug hook.
  await transitionPage.evaluate((top) => scrollTo({ top: top - innerHeight * .86, behavior: "instant" }), horizonTop);
  await transitionPage.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 30_000 });
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
  await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  const top = await page.locator("#horizon").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 30_000 });
  await page.waitForFunction(() => window.__horizonDebug?.().ufoAtlasReady, null, { timeout: 30_000 });
  await page.evaluate(() => window.__horizonDebug.setTime(12));
  await captureViewport(page, "horizon-moon-road-and-wave-glints-1920x1080.png");
  await captureViewport(page, "horizon-boat-lamp-bright-1920x1080.png");
  await page.evaluate(() => window.__horizonDebug.setTime(12.23));
  await captureViewport(page, "horizon-boat-lamp-dim-1920x1080.png");
  await page.evaluate(() => window.__horizonDebug.triggerMeteor("single"));
  await page.evaluate(() => window.__horizonDebug.setTime(13.2766));
  await captureViewport(page, "horizon-meteor-terminal-flash-1920x1080.png");
  await page.evaluate(() => window.__horizonDebug.triggerMeteor("shower"));
  await page.waitForTimeout(620);
  await captureViewport(page, "horizon-meteor-shower-1920x1080.png");
  await page.evaluate(() => window.__horizonDebug.setTime(12));
  await page.evaluate(() => window.__horizonDebug.triggerFirework("cinematic"));
  await page.waitForTimeout(1250);
  await captureViewport(page, "horizon-firework-main-burst-1920x1080.png");
  await page.waitForTimeout(1750);
  await captureViewport(page, "horizon-firework-embers-reflection-1920x1080.png");
  for (const [seconds, filename] of [
    [38.35, "horizon-ufo-emerging-1920x1080.png"],
    [40.52, "horizon-beam-abducting-1920x1080.png"],
    [41.70, "horizon-boat-above-horizon-1920x1080.png"],
    [42.35, "horizon-ufo-returning-1920x1080.png"],
    [43.98, "horizon-boat-respawning-1920x1080.png"],
    [44.38, "horizon-boat-splashdown-falling-1920x1080.png"],
    [44.76, "horizon-boat-splashdown-impact-1920x1080.png"],
    [45.08, "horizon-boat-splashdown-rebound-1920x1080.png"],
    [46.20, "horizon-boat-splashdown-settled-1920x1080.png"]
  ]) {
    await page.evaluate((value) => window.__horizonDebug.setTime(value), seconds);
    await captureViewport(page, filename);
  }
  expect(errors).toEqual([]);
  await context.close();
});
