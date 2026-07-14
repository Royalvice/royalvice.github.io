import { test, expect } from "playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
});

test("profile content is readable without hover and layout has no horizontal overflow", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Zongyuan Yang" })).toBeVisible();
  await expect(page.getByText("Happy Wife! Happy Life!", { exact: true })).toBeVisible();
  await expect(page.getByText("Neural Graphics & 3D AIGC & Interactive World Models")).toBeVisible();
  await expect(page.getByText("3D memory latent development for Interactive World Models", { exact: true })).toBeVisible();
  await expect(page.locator(".godot-copy")).toHaveText("Currently exploring game development with Godot.");
  await expect(page.locator(".terminal-line")).toHaveCount(7);
  const sizes = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(sizes.scroll).toBe(sizes.width);
});

test("Godot heat stage fills the temperature rail before flame surge and steam", async ({ page }) => {
  const status = page.locator(".godot-status");
  await status.hover();
  const readHeat = () => page.evaluate(() => {
    const rail = getComputedStyle(document.querySelector(".godot-rail"), "::before").transform;
    const matrix = new DOMMatrixReadOnly(rail);
    const surge = Number(getComputedStyle(document.querySelector(".flame-surge")).opacity);
    const steam = [...document.querySelectorAll(".godot-steam i")]
      .filter((item) => Number(getComputedStyle(item).opacity) > .02).length;
    return { railScale: matrix.d, surge, steam };
  });
  await expect.poll(async () => {
    const heat = await readHeat();
    return heat.railScale > .98 && heat.surge > .7 && heat.steam > 0;
  }, { timeout: 10_000, intervals: [250, 500, 750] }).toBe(true);
});

test("SIGGRAPH lever resolves the rolling holographic counter at two and can replay", async ({ page }) => {
  const machine = page.locator("[data-siggraph-machine]");
  const lever = page.getByRole("button", { name: /resolve the SIGGRAPH counter/i });
  await expect(machine).toHaveAttribute("data-result", "rolling");
  await lever.dispatchEvent("click");
  await page.waitForFunction(() => document.querySelector("[data-siggraph-machine]")?.classList.contains("is-payout"), null, { timeout: 12_000 });
  await expect(machine).toHaveAttribute("data-result", "2", { timeout: 12_000 });
  await expect(machine).toHaveAttribute("data-pull-count", "1");
  await expect(page.locator("[data-siggraph-track]")).toHaveAttribute("data-target-digit", "2");
  const coins = page.locator(".coin-burst .slot-coin");
  await expect(coins).toHaveCount(24);
  await expect(page.locator(".coin-burst")).toHaveText("");
  await expect(machine).not.toHaveClass(/is-payout/, { timeout: 3_000 });
  await lever.dispatchEvent("click");
  await expect(machine).toHaveAttribute("data-pull-count", "2");
  await expect(machine).toHaveAttribute("data-result", "2", { timeout: 12_000 });
});

test("terminal uses only PAPER and CODE categories with semantic keyword highlighting", async ({ page }) => {
  const types = await page.locator(".terminal-type").allTextContents();
  expect(new Set(types)).toEqual(new Set(["paper", "code"]));
  await expect(page.getByText("TTY / RESEARCH-TAIL", { exact: true })).toBeVisible();
  await expect(page.locator("[data-terminal-buffer]")).toHaveText("BUFFER 07/09");
  await expect(page.locator(".terminal-output-cursor")).toBeVisible();
  await expect(page.locator(".terminal-keyword").first()).toBeVisible();
  await expect(page.locator(".terminal-year-2026").first()).toBeVisible();
  await expect(page.locator(".terminal-year-2025").first()).toBeVisible();
  await expect(page.locator(".terminal-year-2024").first()).toBeVisible();
  await expect(page.locator(".terminal-year-2023").first()).toBeVisible();
});

test("terminal pauses on hover and resumes after leaving", async ({ page }) => {
  const terminal = page.locator(".terminal-shell");
  await terminal.dispatchEvent("mouseenter");
  await expect(terminal).toHaveAttribute("data-paused", "true");
  await expect(page.locator("[data-terminal-state]")).toHaveText("HOLD / HOVER");
  const before = await page.locator(".terminal-lines").innerText();
  await page.waitForTimeout(6_200);
  expect(await page.locator(".terminal-lines").innerText()).toBe(before);
  await terminal.dispatchEvent("mouseleave");
  await expect(terminal).toHaveAttribute("data-paused", "false");
  await expect(page.locator("[data-terminal-state]")).toHaveText("FOLLOW");
});

test("terminal appends one keyed record without replacing retained rows", async ({ page }) => {
  test.setTimeout(90_000);
  const terminal = page.locator(".terminal-shell");
  const toggle = page.locator("[data-terminal-toggle]");
  await toggle.dispatchEvent("click");
  await expect(terminal).toHaveAttribute("data-paused", "true");
  await expect(terminal).not.toHaveClass(/is-ingesting/, { timeout: 10_000 });
  const firstId = await page.locator(".terminal-line").first().getAttribute("data-news-id");
  await page.locator(".terminal-line").nth(1).evaluate((row) => { row.dataset.retainedProbe = "true"; });
  await page.evaluate((previousFirst) => {
    window.__terminalAppendProbe = { resolved: false };
    const terminal = document.querySelector(".terminal-shell");
    const lines = document.querySelector(".terminal-lines");
    const observer = new MutationObserver(() => {
      const first = lines?.firstElementChild;
      if (first?.getAttribute("data-news-id") === previousFirst) return;
      window.__terminalAppendProbe = {
        resolved: true,
        retained: first?.getAttribute("data-retained-probe") === "true",
        rowCount: lines?.children.length,
        ingesting: terminal?.classList.contains("is-ingesting"),
        incomingMarked: lines?.querySelectorAll(".terminal-line.is-ingesting").length === 1,
        state: terminal?.querySelector("[data-terminal-state]")?.textContent
      };
      observer.disconnect();
    });
    if (lines) observer.observe(lines, { childList: true });
  }, firstId);
  await toggle.dispatchEvent("click");
  await expect(terminal).toHaveAttribute("data-paused", "false");
  await page.waitForFunction(() => window.__terminalAppendProbe?.resolved, null, { timeout: 15_000, polling: 100 });
  expect(await page.evaluate(() => window.__terminalAppendProbe)).toEqual({
    resolved: true,
    retained: true,
    rowCount: 7,
    ingesting: true,
    incomingMarked: true,
    state: "INGEST"
  });
  await toggle.dispatchEvent("click");
  await expect(terminal).toHaveAttribute("data-paused", "true");
  await expect(terminal).not.toHaveClass(/is-ingesting/, { timeout: 10_000 });
  await expect(page.locator("[data-terminal-state]")).toHaveText("HOLD / MANUAL");
  await toggle.dispatchEvent("click");
  await expect(terminal).toHaveAttribute("data-paused", "false");
  await expect(page.locator("[data-terminal-state]")).toHaveText("FOLLOW");
});

test("terminal follow control toggles a persistent manual hold", async ({ page }) => {
  const terminal = page.locator(".terminal-shell");
  const toggle = page.locator("[data-terminal-toggle]");
  await toggle.dispatchEvent("click");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(terminal).toHaveAttribute("data-paused", "true");
  await expect(page.locator("[data-terminal-state]")).toHaveText("HOLD / MANUAL");
  await toggle.dispatchEvent("click");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(terminal).toHaveAttribute("data-paused", "false");
});

test("project link destinations and disabled states stay consistent across Voyage and cabinet", async ({ page }) => {
  const voyageLinks = await page.locator("[data-project-card]").evaluateAll((cards) => Object.fromEntries(cards.map((card) => [
    card.getAttribute("data-project-card"),
    [...card.querySelectorAll(".project-link")].map((link) => ({
      label: link.textContent?.trim(),
      tag: link.tagName.toLowerCase(),
      href: link.getAttribute("href"),
      disabled: link.getAttribute("aria-disabled") === "true"
    }))
  ])));

  expect(voyageLinks).toEqual({
    ssat: [
      { label: "Page", tag: "a", href: "https://coronaengine.github.io/ssat-page/", disabled: false },
      { label: "Paper", tag: "span", href: null, disabled: true },
      { label: "Code", tag: "span", href: null, disabled: true }
    ],
    directl: [
      { label: "Page", tag: "a", href: "https://coronaengine.github.io/ssat-page/", disabled: false },
      { label: "arXiv", tag: "a", href: "https://arxiv.org/abs/2407.14053", disabled: false },
      { label: "Code", tag: "span", href: null, disabled: true }
    ],
    eva01: [
      { label: "Page", tag: "a", href: "https://www.seeles.ai/research/pages/EVA01", disabled: false },
      { label: "arXiv", tag: "a", href: "https://arxiv.org/abs/2605.16745", disabled: false },
      { label: "Code", tag: "a", href: "https://github.com/SeeleAI/OpenEVA", disabled: false },
      { label: "Hug", tag: "a", href: "https://huggingface.co/collections/SEELE-AI/openeva", disabled: false }
    ]
  });

  await expect(page.locator("[data-playcanvas-gallery]")).toBeVisible({ timeout: 30_000 });
  const cabinetLinks = await page.locator(".gallery-ui-card").evaluateAll((cards) => Object.fromEntries(cards.map((card) => [
    card.getAttribute("data-project"),
    [...card.querySelectorAll(".gallery-links > *")].map((link) => ({
      label: link.textContent?.trim(),
      tag: link.tagName.toLowerCase(),
      href: link.getAttribute("href"),
      disabled: link.getAttribute("aria-disabled") === "true"
    }))
  ])));

  expect(cabinetLinks).toEqual({
    ssat: [
      { label: "Page", tag: "a", href: "https://coronaengine.github.io/ssat-page/", disabled: false },
      { label: "Paper", tag: "span", href: null, disabled: true },
      { label: "Code", tag: "span", href: null, disabled: true }
    ],
    directl: [
      { label: "Page", tag: "a", href: "https://coronaengine.github.io/ssat-page/", disabled: false },
      { label: "arXiv", tag: "a", href: "https://arxiv.org/abs/2407.14053", disabled: false },
      { label: "Code", tag: "span", href: null, disabled: true }
    ],
    eva01: [
      { label: "Page", tag: "a", href: "https://www.seeles.ai/research/pages/EVA01", disabled: false },
      { label: "arXiv", tag: "a", href: "https://arxiv.org/abs/2605.16745", disabled: false },
      { label: "Code", tag: "a", href: "https://github.com/SeeleAI/OpenEVA", disabled: false },
      { label: "Hug", tag: "a", href: "https://huggingface.co/collections/SEELE-AI/openeva", disabled: false }
    ],
    docdiff: [
      { label: "arXiv", tag: "a", href: "https://arxiv.org/abs/2305.03892", disabled: false },
      { label: "Code", tag: "a", href: "https://github.com/Royalvice/DocDiff", disabled: false }
    ]
  });
});

test("PlayCanvas cabinet loads and supports keyboard selection", async ({ page }) => {
  await expect(page.locator("[data-playcanvas-gallery]")).toBeVisible({ timeout: 30_000 });
  const cards = page.locator(".gallery-ui-card");
  await expect(cards).toHaveCount(4);
  const result = await page.evaluate(() => {
    const items = [...document.querySelectorAll(".gallery-ui-card")];
    const key = (name) => new KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true });
    items[0].focus();
    items[0].dispatchEvent(key("Enter"));
    const entered = items[0].classList.contains("is-active");
    items[0].dispatchEvent(key("ArrowRight"));
    const moved = document.activeElement === items[1];
    items[1].dispatchEvent(key("Escape"));
    return { entered, moved, escaped: !items.some((item) => item.classList.contains("is-active")) };
  });
  expect(result).toEqual({ entered: true, moved: true, escaped: true });
});

test("cabinet trophies are enlarged, grounded, and use focused hover lighting", async ({ page }) => {
  await page.waitForFunction(() => {
    const debug = window.__galleryDebug;
    return typeof debug === "function" && debug().slots?.length === 4;
  }, null, { timeout: 30_000 });
  const rest = await page.evaluate(() => {
    const debug = window.__galleryDebug;
    if (typeof debug !== "function") throw new Error("Gallery debug hook was removed before inspection.");
    return debug();
  });
  expect(rest.slots).toHaveLength(4);
  for (const slot of rest.slots) {
    expect(slot.trophyLocalPosition[0]).toBeCloseTo(0.56, 3);
    expect(slot.trophyLocalPosition[1]).toBeCloseTo(-0.905, 3);
    expect(slot.trophyLocalPosition[2]).toBeCloseTo(0.34, 3);
    expect(slot.trophyScale[0]).toBeGreaterThanOrEqual(0.70);
    expect(slot.spotlightIntensity).toBe(0);
  }

  await page.locator('.gallery-ui-card[data-project="ssat"]').dispatchEvent("pointerenter");
  await expect.poll(async () => {
    const state = await page.evaluate(() => window.__galleryDebug());
    const focused = state.slots.find((slot) => slot.id === "ssat");
    return state.hoverProject === "ssat"
      && focused.spotlightIntensity > 8
      && focused.spotlightEnabled
      && !focused.spotlightCastsShadows
      && state.slots.every((slot) => slot.topLightIntensity < 4.2);
  }, { timeout: 10_000, intervals: [250, 500, 750] }).toBe(true);

  await page.locator('.gallery-ui-card[data-project="ssat"]').dispatchEvent("pointerleave");
  await expect.poll(async () => {
    const state = await page.evaluate(() => window.__galleryDebug());
    const focused = state.slots[0];
    const cabinetDimWeight = (4.62 - focused.topLightIntensity) / (4.62 - 4.62 * 0.085);
    return state.hoverProject === null
      && !focused.spotlightCastsShadows
      && cabinetDimWeight >= focused.spotlightWeight * 0.9;
  }, { timeout: 15_000, intervals: [250, 500, 750] }).toBe(true);
});

test("voyage nodes update the log and future node exposes Horizon", async ({ page }) => {
  await page.getByRole("link", { name: /Voyage/i }).click();
  const docdiff = page.locator('[data-voyage-node="docdiff"]');
  await docdiff.click();
  await expect(page.locator("[data-captains-log] h3")).toHaveText("DocDiff");
  await expect(page.locator('[data-project-card="docdiff"]')).toHaveCount(0);
  const world = page.locator('[data-voyage-node="world"]');
  await world.click();
  await expect(page.locator("[data-captains-log] h3")).toHaveText("Game World Model");
  await expect(page.getByRole("link", { name: /Enter Horizon/i })).toBeVisible();
  await page.evaluate(() => document.querySelector(".captain-actions a")?.click());
  await expect(page.locator("#horizon")).toBeInViewport();
});

test("Horizon is one unified renderer with a sprite boat and no legacy visual layers", async ({ page }) => {
  const top = await page.locator("#horizon").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 30_000 });
  await expect(page.locator("[data-horizon-scene]")).toHaveAttribute("data-scene-ready", "true");
  await expect(page.locator(".horizon-stars,.horizon-moon,.oasis-beacon,.horizon-boat,[data-boat-model=horizon]")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "THE END" })).toBeVisible();
  await expect(page.locator(".horizon-chapters li")).toHaveCount(3);
  const debug = await page.evaluate(() => window.__horizonDebug());
  expect(debug.ready).toBe(true);
  expect(debug.atlasReady).toBe(true);
  expect(debug.internalResolution).toEqual([640, 360]);
  expect(debug.boatScreenPosition[0]).toBeGreaterThan(.60);
  const resources = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name));
  expect(resources.filter((url) => url.includes("research-boat-v1.glb"))).toEqual([]);
});

test("Horizon transition is scroll-driven and uses a single bridge boat", async ({ page }) => {
  await page.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 30_000 });
  const horizonTop = await page.locator("#horizon").evaluate((element) => element.offsetTop);
  const samples = [];
  for (const screenPosition of [.86, .53, .20]) {
    await page.evaluate(({ top, ratio }) => scrollTo({ top: top - innerHeight * ratio, behavior: "instant" }), { top: horizonTop, ratio: screenPosition });
    await page.waitForTimeout(180);
    samples.push(await page.evaluate(() => ({
      progress: Number(getComputedStyle(document.documentElement).getPropertyValue("--journey-progress")),
      bridgeCount: document.querySelectorAll("[data-journey-bridge].is-active").length,
      crossing: document.documentElement.classList.contains("is-journey-crossing")
    })));
  }
  expect(samples[0].progress).toBeLessThan(samples[1].progress);
  expect(samples[1].progress).toBeLessThan(samples[2].progress);
  expect(samples[1]).toMatchObject({ bridgeCount: 1, crossing: true });
  expect(samples[2].bridgeCount).toBe(0);
  expect(await page.evaluate(() => window.__horizonDebug().transitionProgress)).toBeGreaterThan(.95);
});

test("Horizon deterministic meteor hook keeps the rare event testable", async ({ page }) => {
  const top = await page.locator("#horizon").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 30_000 });
  await page.evaluate(() => window.__horizonDebug.triggerMeteor("triple"));
  await expect.poll(() => page.evaluate(() => window.__horizonDebug().meteorCount), { timeout: 4_000 }).toBe(3);
});

test("Horizon launches cinematic fireworks only from a primary canvas tap", async ({ page }) => {
  const top = await page.locator("#horizon").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 30_000 });
  await page.waitForFunction(() => window.__horizonDebug?.().ufoAtlasReady, null, { timeout: 30_000 });
  const canvas = page.locator("[data-horizon-scene]");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box.x + box.width * .47, box.y + box.height * .24);
  await expect.poll(() => page.evaluate(() => window.__horizonDebug().fireworkCount)).toBe(1);
  expect(await page.evaluate(() => window.__horizonDebug().fireworkEventCount)).toBeGreaterThanOrEqual(4);
  expect(await page.evaluate(() => window.__horizonDebug().fireworkEventCount)).toBeLessThanOrEqual(5);
  await page.mouse.click(box.x + box.width * .52, box.y + box.height * .62, { button: "right" });
  expect(await page.evaluate(() => window.__horizonDebug().fireworkCount)).toBe(1);
  await page.mouse.move(box.x + box.width * .22, box.y + box.height * .68);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .65, box.y + box.height * .68);
  await page.mouse.up();
  expect(await page.evaluate(() => window.__horizonDebug().fireworkCount)).toBe(1);
  await page.evaluate(() => window.__horizonDebug.triggerFirework("cinematic"));
  await page.evaluate(() => window.__horizonDebug.triggerFirework("cinematic"));
  await page.evaluate(() => window.__horizonDebug.triggerFirework("cinematic"));
  expect(await page.evaluate(() => window.__horizonDebug().fireworkCount)).toBe(3);
});

test("Horizon UFO cycle has deterministic stages and returns the boat to its origin", async ({ page }) => {
  const top = await page.locator("#horizon").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 30_000 });
  await page.waitForFunction(() => window.__horizonDebug?.().ufoAtlasReady, null, { timeout: 30_000 });
  const phases = [
    [38.2, "ufo-emerging"], [39.2, "ufo-approaching"], [40.3, "beam-opening"], [41.2, "abducting"],
    [42.2, "returning-to-moon"], [43.4, "moon-transfer"], [44.1, "boat-respawning"], [45.0, "restart-pause"]
  ];
  for (const [seconds, phase] of phases) {
    await page.evaluate((value) => window.__horizonDebug.setTime(value), seconds);
    expect(await page.evaluate(() => window.__horizonDebug().boatCyclePhase)).toBe(phase);
  }
  await page.evaluate(() => window.__horizonDebug.setTime(41.4));
  const lifted = await page.evaluate(() => window.__horizonDebug());
  expect(lifted.boatLift).toBeGreaterThan(0);
  expect(lifted.beamStrength).toBeGreaterThan(0);
  await page.evaluate(() => window.__horizonDebug.setTime(44.5));
  const respawn = await page.evaluate(() => window.__horizonDebug());
  expect(respawn.boatScreenPosition[0]).toBeLessThan(.63);
});

test("Horizon keeps the sea live when the optional UFO atlas cannot load", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "dark" });
  const page = await context.newPage();
  await page.route("**/ufo-atlas.png", (route) => route.abort("failed"));
  await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  const top = await page.locator("#horizon").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => window.__horizonDebug().ufoAtlasReady)).toBe(false);
  const debug = await page.evaluate(() => window.__horizonDebug());
  expect(debug.atlasReady).toBe(true);
  expect(debug.moonReflectionStrength).toBeGreaterThan(0);
  await context.close();
});

test("Horizon navigation recedes after settling and returns for keyboard focus", async ({ page }) => {
  const top = await page.locator("#horizon").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 30_000 });
  await expect(page.locator("html")).toHaveClass(/horizon-ui-settled/, { timeout: 5_000 });
  const nav = page.locator(".chapter-nav");
  await expect.poll(() => nav.evaluate((element) => Number(getComputedStyle(element).opacity))).toBeLessThan(.5);
  await page.getByRole("link", { name: /Horizon/i }).focus();
  await expect.poll(() => nav.evaluate((element) => Number(getComputedStyle(element).opacity))).toBeGreaterThan(.9);
});

test("Horizon keeps a visible fallback when WebGL2 is unavailable", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "dark" });
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (type === "webgl2") return null;
      return original.call(this, type, ...args);
    };
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
  const top = await page.locator("#horizon").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await expect(page.locator("#horizon")).toHaveClass(/horizon-fallback-active/);
  await expect(page.locator(".horizon-fallback")).toBeVisible();
  await expect(page.getByRole("heading", { name: "THE END" })).toBeVisible();
  await context.close();
});

test("mobile Horizon uses an aspect-correct internal canvas and includes the boat", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
  const top = await page.locator("#horizon").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 30_000 });
  const debug = await page.evaluate(() => window.__horizonDebug());
  expect(debug.internalResolution[0]).toBeLessThanOrEqual(320);
  expect(debug.internalResolution[1]).toBeGreaterThan(debug.internalResolution[0]);
  expect(debug.boatScreenPosition[0]).toBeGreaterThan(.60);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await context.close();
});

test("reduced motion exposes the static final state", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Zongyuan Yang" }).waitFor();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await expect(page.getByRole("heading", { name: "Zongyuan Yang" })).toBeVisible();
  await expect(page.locator("[data-siggraph-machine]")).toHaveAttribute("data-result", "2");
  await expect(page.locator("[data-terminal-state]")).toHaveText("FOLLOW");
  await expect(page.locator(".terminal-line")).toHaveCount(7);
  const horizonTop = await page.locator("#horizon").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), horizonTop);
  await page.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 30_000 });
  const horizon = await page.evaluate(() => window.__horizonDebug());
  expect(horizon.transitionProgress).toBe(1);
  expect(horizon.boatProgress).toBe(1);
  expect(horizon.meteorCount).toBe(0);
  await expect(page.locator("[data-journey-bridge]")).not.toHaveClass(/is-active/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  await context.close();
});
