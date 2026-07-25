import { test, expect } from "playwright/test";

const manualContextTests = new Set([
  "Voyage falls back per landmark without taking down the unified ocean",
  "Voyage reflection pass degrades independently to analytic water",
  "desktop Evidence is a complete single-frame viewer inside the lower right rail",
  "Voyage keeps semantic controls and poster art when WebGL2 is unavailable",
  "mobile Voyage uses a portrait pixel canvas and a vertical semantic route",
  "Horizon keeps the sea live when the optional UFO atlas cannot load",
  "Horizon keeps a visible fallback when WebGL2 is unavailable",
  "mobile Horizon uses an aspect-correct internal canvas and includes the boat",
  "mobile gallery keeps all four project targets aligned and inside the viewport",
  "reduced motion exposes the static final state"
]);

test.beforeEach(async ({ page }, testInfo) => {
  // Tests that create their own context perform their own navigation. Keeping
  // this auto page blank avoids running an unused second pair of WebGL scenes.
  if (manualContextTests.has(testInfo.title)) return;
  // The real badge is intentionally loaded on localhost, but automated test
  // refreshes must not inflate the public counter.
  await page.route("https://api.visitorbadge.io/api/combined?*", (route) => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="134" height="20" role="img"><rect width="134" height="20" fill="#060d09"/><rect x="61" width="73" height="20" fill="#1b6e3a"/><text x="6" y="14" fill="#9df5aa" font-size="9">VISITORS</text><text x="67" y="14" fill="#fff" font-size="9">7 / 1,713</text></svg>'
  }));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Zongyuan Yang" }).waitFor();
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

test("visitor telemetry uses the historical counter path and combined today-total count", async ({ page }) => {
  const badge = page.locator("[data-visitor-telemetry]");
  await expect(badge).toBeVisible();
  await expect(badge).toHaveAttribute("href", "https://visitorbadge.io/status?path=https%3A%2F%2Froyalvice.github.io%2F");
  await expect(badge).toHaveAttribute("data-state", "live");
  await expect(badge).toContainText("TODAY / TOTAL");
  await expect(page.locator("[data-visitor-fallback]")).toBeHidden();
  await expect(page.locator("[data-visitor-image]")).toHaveAttribute("src", /api\/combined\?path=https%3A%2F%2Froyalvice\.github\.io%2F/);
  await expect(page.locator("[data-visitor-image]")).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(page.locator("[data-visitor-image]")).toBeVisible();
  const telemetryGeometry = await page.evaluate(() => {
    const route = document.querySelector(".research-route")?.getBoundingClientRect();
    const telemetry = document.querySelector("[data-visitor-telemetry]")?.getBoundingClientRect();
    return route && telemetry ? {
      routeRight: route.right,
      telemetryLeft: telemetry.left,
      verticalDelta: Math.abs(route.top - telemetry.top)
    } : null;
  });
  expect(telemetryGeometry).not.toBeNull();
  expect(telemetryGeometry.telemetryLeft).toBeGreaterThanOrEqual(telemetryGeometry.routeRight);
  expect(telemetryGeometry.verticalDelta).toBeLessThan(12);
  await page.locator("[data-visitor-image]").dispatchEvent("error");
  await expect(badge).toHaveAttribute("data-state", "offline");
  await expect(page.locator("[data-visitor-fallback]")).toHaveText("SIGNAL OFFLINE");
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
    if (!await status.evaluate((element) => element.matches(":hover"))) await status.hover();
    const heat = await readHeat();
    return heat.railScale > .98 && heat.surge > .7 && heat.steam > 0;
  }, { timeout: 20_000, intervals: [250, 500, 750] }).toBe(true);
});

test("SIGGRAPH lever resolves the rolling holographic counter at three and can replay", async ({ page }) => {
  const machine = page.locator("[data-siggraph-machine]");
  const lever = page.getByRole("button", { name: /resolve the SIGGRAPH counter/i });
  await expect(machine).toHaveAttribute("data-result", "rolling");
  await lever.dispatchEvent("click");
  await page.waitForFunction(() => document.querySelector("[data-siggraph-machine]")?.classList.contains("is-payout"), null, { timeout: 12_000 });
  await expect(machine).toHaveAttribute("data-result", "3", { timeout: 12_000 });
  await expect(machine).toHaveAttribute("data-pull-count", "1");
  await expect(page.locator("[data-siggraph-track]")).toHaveAttribute("data-target-digit", "3");
  const coins = page.locator(".coin-burst .slot-coin");
  await expect(coins).toHaveCount(24);
  await expect(page.locator(".coin-burst")).toHaveText("");
  await expect(machine).not.toHaveClass(/is-payout/, { timeout: 3_000 });
  await lever.dispatchEvent("click");
  await expect(machine).toHaveAttribute("data-pull-count", "2");
  await expect(machine).toHaveAttribute("data-result", "3", { timeout: 12_000 });
});

test("terminal uses research-domain signals and unified news sentences", async ({ page }) => {
  await expect(page.locator(".terminal-type")).toHaveCount(0);
  const domainBadges = await page.locator("[data-terminal-domain]").evaluateAll((items) => items.map((item) => ({
    domain: item.getAttribute("data-terminal-domain"),
    active: item.getAttribute("data-active")
  })));
  expect(domainBadges).toEqual([
    { domain: "neural-graphics", active: "true" },
    { domain: "agent-harness", active: "true" },
    { domain: "mllm", active: "true" },
    { domain: "game-world-model", active: "false" }
  ]);
  expect(await page.locator(".terminal-line").evaluateAll((items) => Object.fromEntries(items.map((item) => [
    item.getAttribute("data-news-id"), item.querySelector("[data-news-domain]")?.getAttribute("data-news-domain")
  ])))).toEqual({
    "thoth-010": "agent-harness",
    eva01: "mllm",
    "eccv-2026": "unclassified",
    "siggraph-2026": "neural-graphics",
    "iccv-2025": "unclassified",
    "directl-2024": "neural-graphics",
    "docdiff-2023": "unclassified"
  });
  await expect(page.locator("[data-news-id=directl-2024] .terminal-message")).toHaveText("DirectL — Accepted to ACM TOG; presented at SIGGRAPH Asia 2024.");
  await expect(page.locator("[data-news-id=siggraph-2026] .terminal-message")).toHaveText("SSAT — Accepted to SIGGRAPH 2026.");
  const timeline = await page.locator(".terminal-line").evaluateAll((items) => items.map((item) => ({
    id: item.getAttribute("data-news-id"),
    date: item.querySelector("time")?.getAttribute("datetime")
  })));
  expect(timeline).toEqual([
    { id: "thoth-010", date: "2026.07" },
    { id: "eva01", date: "2026.07" },
    { id: "eccv-2026", date: "2026.06" },
    { id: "siggraph-2026", date: "2026.04" },
    { id: "iccv-2025", date: "2025.05" },
    { id: "directl-2024", date: "2024.10" },
    { id: "docdiff-2023", date: "2023.05" }
  ]);
  const eventLefts = await page.locator(".terminal-event").evaluateAll((items) => items.map((item) => item.getBoundingClientRect().left));
  expect(Math.max(...eventLefts) - Math.min(...eventLefts)).toBeLessThan(1);
  await expect(page.getByText("TTY / RESEARCH-TAIL", { exact: true })).toBeVisible();
  await expect(page.locator("[data-terminal-buffer]")).toHaveText("BUFFER 07/09");
  await expect(page.locator(".terminal-output-cursor")).toBeVisible();
  await expect(page.locator(".terminal-lines + .terminal-cycle-boundary")).toContainText("END OF NEWS");
  await expect(page.locator(".terminal-cycle-boundary")).toContainText("LOOP ↻");
  await expect(page.locator(".terminal-keyword").first()).toBeVisible();
  await expect(page.locator(".terminal-year-2026").first()).toBeVisible();
  await expect(page.locator(".terminal-year-2025").first()).toBeVisible();
  await expect(page.locator(".terminal-year-2024").first()).toBeVisible();
  await expect(page.locator(".terminal-year-2023").first()).toBeVisible();
});

test("cabinet plaques expose the four authoritative venue labels", async ({ page }) => {
  await expect(page.locator("[data-playcanvas-gallery]")).toBeVisible({ timeout: 30_000 });
  const labels = await page.locator(".gallery-ui-card").evaluateAll((cards) => cards.map((card) => ({
    id: card.getAttribute("data-project"),
    title: card.querySelector(".gallery-hotspot-label b")?.textContent?.trim(),
    venue: card.querySelector(".gallery-hotspot-label small")?.textContent?.trim()
  })));
  expect(labels).toEqual([
    { id: "ssat", title: "SSAT", venue: "SIGGRAPH 2026" },
    { id: "directl", title: "DirectL", venue: "ACM TOG · SIGGRAPH Asia 2024" },
    { id: "eva01", title: "EVA01", venue: "ACM TOG · SIGGRAPH Asia 2026" },
    { id: "docdiff", title: "DocDiff", venue: "ACM MM 2023" }
  ]);
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

test("terminal live refresh preserves strict reverse chronological order", async ({ page }) => {
  test.setTimeout(90_000);
  const terminal = page.locator(".terminal-shell");
  const toggle = page.locator("[data-terminal-toggle]");
  await toggle.dispatchEvent("click");
  await expect(terminal).toHaveAttribute("data-paused", "true");
  await expect(terminal).not.toHaveClass(/is-ingesting/, { timeout: 10_000 });
  const initialOrder = await page.locator(".terminal-line").evaluateAll((items) => items.map((item) => item.getAttribute("data-news-id")));
  const initialSequence = Number(await terminal.getAttribute("data-refresh-sequence") || "0");
  await toggle.dispatchEvent("click");
  await expect(terminal).toHaveAttribute("data-paused", "false");
  await expect.poll(async () => Number(await terminal.getAttribute("data-refresh-sequence") || "0"), { timeout: 15_000 }).toBeGreaterThan(initialSequence);
  expect(await page.locator(".terminal-line").evaluateAll((items) => items.map((item) => item.getAttribute("data-news-id")))).toEqual(initialOrder);
  await expect(page.locator(".terminal-line")).toHaveCount(7);
  await toggle.dispatchEvent("click");
  await expect(terminal).toHaveAttribute("data-paused", "true");
  await expect(terminal).not.toHaveClass(/is-ingesting/, { timeout: 10_000 });
  await expect(page.locator("[data-terminal-state]")).toHaveText("HOLD / MANUAL");
  await toggle.dispatchEvent("click");
  await expect(terminal).toHaveAttribute("data-paused", "false");
  await expect(page.locator("[data-terminal-state]")).toHaveText(/FOLLOW|INGEST/);
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
    ],
    docdiff: [
      { label: "arXiv", tag: "a", href: "https://arxiv.org/abs/2305.03892", disabled: false },
      { label: "Code", tag: "a", href: "https://github.com/Royalvice/DocDiff", disabled: false }
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

test("living profile dungeon loads approved room-v4 atlases and runs one deterministic actor instance each", async ({ page }) => {
  test.setTimeout(180_000);
  await page.waitForFunction(() => window.__profileAdventureDebug?.getState().ready, null, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "THE LIVING RESEARCH DUNGEON" })).toBeVisible();
  await expect(page.locator(".profile-adventure-stage")).toBeVisible();
  await expect(page.locator("[data-profile-actor]")).toHaveCount(5);
  await expect(page.locator("[data-profile-door]")).toBeVisible();
  await expect(page.locator("[data-profile-reset]")).toContainText("RESET ROOM");
  await expect(page.getByText("Hanging chandelier")).toBeAttached();
  await expect(page.getByText("Television playing a silent maze chase")).toBeAttached();

  const manifest = await page.evaluate(async () => {
    const response = await fetch("/assets/profile/adventure/room-v4/profile-room-v4-manifest.json");
    return response.json();
  });
  expect(Object.keys(manifest.actors).sort()).toEqual(["doraemon", "gian", "nobita", "shizuka", "suneo"]);
  const actorUrls = [];
  for (const actor of Object.values(manifest.actors)) {
    for (const kind of [actor.base, actor.movement, actor.life]) {
      expect(kind.approvedFrames).toBe(9);
      expect(kind.size).toEqual([384, 384]);
      expect(kind.frameSize).toEqual([128, 128]);
      expect(kind.frameOrder).toHaveLength(9);
      expect(kind.sha256).toMatch(/^[a-f0-9]{64}$/);
      actorUrls.push(kind.url);
    }
  }
  expect(manifest.actors.nobita.movement.runtimeFrameCount).toBe(3);
  expect(manifest.actors.nobita.movement.runtimeFrameIndices).toEqual([0, 1, 2]);
  expect(manifest.actors.nobita.movement.compatibilityDuplicateCells).toEqual([]);
  expect(manifest.furniture.size).toEqual([384, 384]);
  expect(manifest.furniture.frameOrder).toEqual(["chandelier", "blackboard", "eraser", "secondary-desk", "chair", "sofa", "water-cooler", "tv-cabinet", "ps5"]);
  expect(manifest.door.frameOrder).toEqual(["closed", "open"]);
  expect(manifest.door.size).toEqual([256, 128]);
  expect(manifest.lamps.frameOrder).toEqual(["low", "left", "high", "right"]);
  expect(manifest.lamps.size).toEqual([256, 96]);
  expect(manifest.posters.spiritedAway.size).toEqual([48, 64]);
  expect(manifest.posters.onePieceEastBlue.size).toEqual([48, 64]);

  const dimensions = await page.evaluate(async (urls) => Promise.all(urls.map(async (url) => {
    const image = new Image();
    image.src = url;
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  })), actorUrls);
  expect(dimensions).toEqual(Array.from({ length: 15 }, () => [384, 384]));

  const samples = await page.evaluate((times) => times.map((time) => {
    window.__profileAdventureDebug.setTime(time);
    return window.__profileAdventureDebug.getState();
  }), [0, 2, 5, 9.75, 24, 25, 28.75, 300]);
  expect(samples[0].actors.suneo.position).not.toEqual(samples[1].actors.suneo.position);
  // Walking is intentionally slow and route-dependent now. Validate the
  // state machine by its actual activity semantics instead of assuming that
  // every actor must arrive at a station at an arbitrary wall-clock second.
  expect(Object.values(samples[0].actors).every((actor) => actor.state === "walking")).toBe(true);
  expect(samples[2].actors.shizuka.state).toBe("watching-tv");
  expect(samples[3].actors.doraemon.state).toBe("walking");
  expect(samples[7].actors.nobita.visitedStations.length).toBeGreaterThan(0);

  const portalTimeline = await page.evaluate(() => {
    window.__profileAdventureDebug.reset();
    const states = [];
    for (let step = 0; step < 160; step += 1) {
      // The entering clip is 1.4s; a sub-second probe must not jump over it.
      window.__profileAdventureDebug.advanceTime(0.75);
      const state = window.__profileAdventureDebug.getState();
      const entry = Object.entries(state.actors).find(([, actor]) => ["portal-entering", "portal-away", "portal-returning"].includes(actor.state));
      if (entry) states.push({ time: state.simulationElapsed, id: entry[0], state: entry[1].state, visible: entry[1].visible });
      if (states.some((item) => item.state === "portal-away") && states.some((item) => item.state === "portal-returning")) break;
    }
    return states;
  });
  expect(portalTimeline.some((entry) => entry.state === "portal-entering")).toBe(true);
  expect(portalTimeline.some((entry) => entry.state === "portal-away" && entry.visible === false)).toBe(true);
  expect(portalTimeline.some((entry) => entry.state === "portal-returning" && entry.visible === true)).toBe(true);
  expect(samples.every((state) => Object.values(state.stationOccupancy).every((ids) => ids.length <= 1))).toBe(true);
  expect(samples.every((state) => Object.values(state.actors).every((actor) => actor.renderInstanceCount === (actor.visible ? 1 : 0)))).toBe(true);
  expect(Object.values(samples[0].assets.actors)).toEqual(["ready", "ready", "ready", "ready", "ready"]);
  expect(samples[0].assets.furniture).toBe("ready");
  expect(samples[0].assets.door).toBe("ready");
  expect(samples[0].assets.lamps).toBe("ready");
  expect(samples[0].assets.posters).toBe("ready");
  expect(samples[0].layout.tvChildAnchors.ps5).toEqual([0.73, 0.61]);

  const visited = Object.values(samples.at(-1).actors).flatMap((actor) => actor.visitedStations);
  for (const station of ["blackboard", "water-cooler", "primary-desk", "secondary-desk", "sofa-left", "tv-console", "anywhere-door"]) {
    expect(visited).toContain(station);
  }
  const spacing = await page.evaluate(() => {
    let minimum = Infinity;
    for (let time = 0; time <= 180; time += 2) {
      window.__profileAdventureDebug.setTime(time);
      const visible = Object.values(window.__profileAdventureDebug.getState().actors).filter((actor) => actor.visible);
      for (let first = 0; first < visible.length; first += 1) {
        for (let second = first + 1; second < visible.length; second += 1) {
          minimum = Math.min(minimum, Math.hypot(
            visible[first].position[0] - visible[second].position[0],
            visible[first].position[1] - visible[second].position[1]
          ));
        }
      }
    }
    return minimum;
  });
  expect(spacing).toBeGreaterThanOrEqual(.063);

  const tvStates = await page.evaluate(() => [1, 8].map((time) => {
    window.__profileAdventureDebug.setTime(time);
    const state = window.__profileAdventureDebug.getState();
    return [state.tvFrame, state.tvPelletsRemaining];
  }));
  expect(tvStates[0]).not.toEqual(tvStates[1]);

  const deterministic = await page.evaluate(() => {
    window.__profileAdventureDebug.setTime(0);
    const before = window.__profileAdventureDebug.getState();
    window.__profileAdventureDebug.setTime(71);
    window.__profileAdventureDebug.reset();
    const after = window.__profileAdventureDebug.getState();
    return {
      before: Object.fromEntries(Object.entries(before.actors).map(([id, actor]) => [id, actor.position])),
      after: Object.fromEntries(Object.entries(after.actors).map(([id, actor]) => [id, actor.position])),
      beforeTv: [before.tvFrame, before.tvPelletsRemaining],
      afterTv: [after.tvFrame, after.tvPelletsRemaining]
    };
  });
  expect(deterministic.after).toEqual(deterministic.before);
  expect(deterministic.afterTv).toEqual(deterministic.beforeTv);
  await expect(page.locator(".profile-adventure-handoff")).toHaveCount(0);
  const galleryDebug = await page.evaluate(() => window.__galleryDebug?.());
  expect(galleryDebug).not.toHaveProperty("adventure");
});

test("profile room controls use ground focus, manual actions, unique portal transit, and freeze on pause", async ({ page }) => {
  // Software WebGL on CI can spend most of the default budget compiling the
  // room and cabinet shaders before this long deterministic interaction pass.
  test.setTimeout(240_000);
  await page.waitForFunction(() => window.__profileAdventureDebug?.getState().ready, null, { timeout: 60_000 });
  const nobita = page.locator('[data-profile-actor="nobita"]');
  await nobita.focus();
  await expect.poll(() => page.evaluate(() => window.__profileAdventureDebug.getState().focusedActor)).toBe("nobita");
  const focusStyle = await nobita.evaluate((element) => ({
    outline: getComputedStyle(element).outlineStyle,
    after: getComputedStyle(element, "::after").content
  }));
  expect(focusStyle.outline).toBe("none");
  expect(["none", "normal"]).toContain(focusStyle.after);
  await nobita.click();
  await expect.poll(() => page.evaluate(() => window.__profileAdventureDebug.getState().actors.nobita.state)).toBe("manual-action");
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => window.__profileAdventureDebug.getState().actors.nobita.state)).not.toBe("manual-action");

  const transit = await page.evaluate(() => {
    window.__profileAdventureDebug.reset();
    for (let step = 0; step < 40; step += 1) {
      window.__profileAdventureDebug.advanceTime(3);
      const state = window.__profileAdventureDebug.getState();
      const entry = Object.entries(state.actors).find(([, actor]) => actor.state === "portal-away");
      if (entry) return { time: state.simulationElapsed, id: entry[0] };
    }
    return null;
  });
  expect(transit).not.toBeNull();
  await page.evaluate((value) => window.__profileAdventureDebug.setTime(value.time), transit);
  const transitButton = page.locator(`[data-profile-actor="${transit.id}"]`);
  await expect(transitButton).toBeDisabled();
  await expect(transitButton).toHaveAttribute("tabindex", "-1");
  const away = await page.evaluate(() => window.__profileAdventureDebug.getState());
  expect(away.doorUser).toBe(transit.id);
  expect(away.actors[transit.id].renderInstanceCount).toBe(0);
  const returned = await page.evaluate((value) => {
    for (let offset = 1; offset <= 20; offset += 1) {
      window.__profileAdventureDebug.setTime(value.time + offset);
      const state = window.__profileAdventureDebug.getState();
      if (state.actors[value.id].visible) return state;
    }
    return window.__profileAdventureDebug.getState();
  }, transit);
  await expect(transitButton).toBeEnabled();
  expect(returned.actors[transit.id].renderInstanceCount).toBe(1);

  await page.evaluate(() => window.__profileAdventureDebug.setTime(1));
  await page.evaluate(() => window.__profileAdventureDebug.play());
  await page.waitForTimeout(320);
  await page.evaluate(() => window.__profileAdventureDebug.pause());
  const frozen = await page.evaluate(() => window.__profileAdventureDebug.getState());
  await page.waitForTimeout(260);
  const stillFrozen = await page.evaluate(() => window.__profileAdventureDebug.getState());
  expect(stillFrozen.simulationElapsed).toBe(frozen.simulationElapsed);
  expect(stillFrozen.tvFrame).toBe(frozen.tvFrame);
  expect(stillFrozen.actorPositions).toEqual(frozen.actorPositions);

  await page.evaluate(() => window.__profileAdventureDebug.setTime(0));
  await page.locator("[data-profile-door]").click();
  await expect.poll(() => page.evaluate(() => window.__profileAdventureDebug.getState().doorFrame)).toBe("open");
  expect((await page.evaluate(() => window.__profileAdventureDebug.getState())).doorUser).toBe(null);
});

test("room-v4 actor failures stay local, reduced motion is static, and the removed 3d runner is never requested", async ({ browser }) => {
  test.setTimeout(300_000);
  const fallback = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await fallback.newPage();
  let requestedRiggedModel = false;
  page.on("request", (request) => {
    if (request.url().includes("nobita-adventure.glb")) requestedRiggedModel = true;
  });
  for (const route of [
    "**/room-v4/actors/suneo-movement-3x3.webp",
    "**/room-v3/furniture/furniture-grounded-v4-3x3.webp",
    "**/room-v3/props/anywhere-door-2x1.webp",
    "**/room-v3/props/bulkhead-wall-lamp-v4-4x1.webp",
    "**/room-v3/posters/spirited-away-pixel.webp"
  ]) await page.route(route, (handler) => handler.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__profileAdventureDebug?.getState().ready, null, { timeout: 120_000 });
  await page.evaluate(() => window.__profileAdventureDebug.setTime(9.75));
  const state = await page.evaluate(() => window.__profileAdventureDebug.getState());
  expect(state.assets.actors.suneo).toBe("partial-fallback");
  expect(Object.entries(state.assets.actors).filter(([id, status]) => id !== "suneo" && status === "ready")).toHaveLength(4);
  expect(state.assets.furniture).toBe("fallback");
  expect(state.assets.door).toBe("fallback");
  expect(state.assets.lamps).toBe("fallback");
  expect(state.assets.posters).toBe("fallback");
  expect(requestedRiggedModel).toBe(false);
  await expect(page.locator(".profile-sprite-canvas")).toBeVisible();
  await expect(page.locator(".gallery-stage")).toBeVisible();
  await fallback.close();

  const reduced = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  const reducedPage = await reduced.newPage();
  await reducedPage.goto("/", { waitUntil: "domcontentloaded" });
  await reducedPage.waitForFunction(() => window.__profileAdventureDebug?.getState().ready, null, { timeout: 120_000 });
  const first = await reducedPage.evaluate(() => window.__profileAdventureDebug.getState());
  await reducedPage.waitForTimeout(350);
  const second = await reducedPage.evaluate(() => window.__profileAdventureDebug.getState());
  expect(first.running).toBe(false);
  expect(first.paused).toBe(true);
  expect(first.doorFrame).toBe("closed");
  expect(Object.values(first.actors).every((actor) => actor.visible && actor.renderInstanceCount === 1)).toBe(true);
  expect(second.simulationElapsed).toBe(first.simulationElapsed);
  expect(second.tvFrame).toBe(first.tvFrame);
  expect(second.actorPositions).toEqual(first.actorPositions);
  await reduced.close();
});

test("THE LUMINOUS WAKE is one unified pixel voyage without dashboard-era layers", async ({ page }) => {
  const top = await page.locator("#voyage").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.waitForFunction(() => window.__voyageDebug?.().ready, null, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "THE LUMINOUS WAKE" })).toBeVisible();
  await expect(page.getByText("Neural Graphics → Native 3D → Interactive World Models", { exact: true })).toBeVisible();
  await expect(page.locator("[data-voyage-scene]")).toHaveAttribute("data-scene-ready", "true");
  await expect(page.locator(".voyage-route,.pixel-ocean,[data-landmark-scene],[data-voyage-boat],.evidence-deck,.voyage-side,.support-drawers")).toHaveCount(0);
  await expect(page.locator("[data-voyage-node]")).toHaveCount(5);
  await page.evaluate(() => window.__voyageDebug.setIntroTime(5.2));
  const debug = await page.evaluate(() => window.__voyageDebug());
  expect(debug.currentStage).toBe("eva01");
  expect(debug.selectedNode).toBe("eva01");
  expect(debug.internalResolution).toEqual([960, 540]);
  expect(debug.wakeStrength).toBeGreaterThan(.9);
  expect(debug.reflectionStrength).toBeGreaterThan(.6);
  expect(debug.cameraProjection).toBe("perspective");
  expect(debug.cameraPitch).toBeGreaterThanOrEqual(72);
  expect(debug.cameraPitch).toBeLessThanOrEqual(78);
  expect(debug.waterMode).toBe("xz-gerstner");
  expect(debug.reflectionMode).toBe("planar");
  await expect.poll(() => page.evaluate(() => Object.values(window.__voyageDebug().landmarkAssets)), { timeout: 90_000 }).toEqual(["v3-lod", "v3-lod", "v3-lod", "v3-lod", "v3-lod"]);
  expect(await page.evaluate(() => window.__voyageDebug().boatAsset)).toBe("v3-lod");
});

test("Voyage floating archipelago shares one deterministic wave field with mass-specific responses", async ({ page }) => {
  const top = await page.locator("#voyage").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.waitForFunction(() => window.__voyageDebug?.().ready, null, { timeout: 60_000 });
  await page.waitForFunction(() => Object.values(window.__voyageDebug().landmarkAssets).every((state) => state === "v3-lod"), null, { timeout: 90_000 });
  await page.evaluate(() => {
    window.__voyageDebug.setIntroTime(5.2);
    window.__voyageDebug.setSceneTime(2.25);
  });
  const first = await page.evaluate(() => window.__voyageDebug().floatingBodies);
  await page.evaluate(() => window.__voyageDebug.setSceneTime(18));
  const second = await page.evaluate(() => window.__voyageDebug().floatingBodies);
  expect(Object.keys(second).sort()).toEqual(["boat", "directl", "docdiff", "eva01", "neural", "world"]);
  for (const body of Object.values(second)) {
    expect(body.contactStrength).toBeGreaterThan(0);
    expect(body.reflectionStrength).toBeGreaterThan(0);
  }
  expect(Math.abs(first.boat.height - second.boat.height)).toBeGreaterThan(.005);
  expect(Math.abs(first.eva01.roll - second.eva01.roll)).toBeGreaterThan(.01);
  const boatMotion = Math.abs(second.boat.pitch) + Math.abs(second.boat.roll);
  const gateMotion = Math.abs(second.world.pitch) + Math.abs(second.world.roll);
  expect(boatMotion).toBeGreaterThan(gateMotion * 5);
  expect(Math.abs(second.boat.pitch)).toBeLessThanOrEqual(4);
  expect(Math.abs(second.boat.roll)).toBeLessThanOrEqual(6);
  expect(Math.abs(second.world.pitch)).toBeLessThanOrEqual(.5);
  expect(Math.abs(second.world.roll)).toBeLessThanOrEqual(.5);
  expect(second.boat.height).not.toBeCloseTo(second.eva01.height, 2);
});

test("Voyage runs one seamless 60-second daylight, sunset, moonlight, and dawn environment cycle", async ({ page }) => {
  const top = await page.locator("#voyage").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.waitForFunction(() => window.__voyageDebug?.().ready, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__voyageDebug().assetsReady, null, { timeout: 180_000 });
  const samples = await page.evaluate((times) => {
    window.__voyageDebug.setIntroTime(5.2);
    return times.map((time) => {
      window.__voyageDebug.setSceneTime(time);
      const state = window.__voyageDebug();
      return {
        time,
        phase: state.environmentPhase,
        cycle: state.environmentCycleElapsed,
        sun: state.sunStrength,
        moon: state.moonStrength,
        sunReflection: state.sunReflectionStrength,
        moonReflection: state.moonReflectionStrength,
        lighthouse: state.lighthouseBeamStrength,
        oasisGhost: state.oasisGhostStrength,
        route: state.routeSpectrumStrength,
        waterLuminance: state.waterLuminance,
        shadow: state.shadowDirection,
        beamDirection: state.lighthouseBeamDirection
      };
    });
  }, [0, 18, 34, 42, 45, 56, 60]);
  expect(samples.map((sample) => sample.phase)).toEqual(["morning", "noon", "sunset", "night", "night", "dawn", "morning"]);
  expect(samples[0].sun).toBeGreaterThan(samples[0].moon * 10);
  expect(samples[4].moon).toBeGreaterThan(samples[4].sun * 20);
  expect(samples[0].sunReflection).toBeGreaterThan(samples[0].moonReflection);
  expect(samples[4].moonReflection).toBeGreaterThan(samples[4].sunReflection);
  expect(samples[1].lighthouse).toBeLessThan(samples[0].lighthouse);
  expect(samples[4].lighthouse).toBeGreaterThan(samples[0].lighthouse * 3);
  expect(samples[0].lighthouse).toBeGreaterThan(.35);
  expect(samples[4].lighthouse).toBeGreaterThan(1.3);
  expect(samples[0].waterLuminance).toBeGreaterThan(.3);
  expect(samples[1].waterLuminance).toBeGreaterThan(.38);
  expect(samples[4].waterLuminance).toBeLessThan(.1);
  expect(samples[0].oasisGhost).toBeLessThan(.05);
  expect(samples[1].oasisGhost).toBeLessThan(.05);
  expect(samples[4].oasisGhost).toBeGreaterThan(.85);
  expect(samples[6].oasisGhost).toBeCloseTo(samples[0].oasisGhost, 8);
  expect(samples.every((sample) => sample.route > .6)).toBe(true);
  expect(samples[6].cycle).toBeCloseTo(0, 8);
  expect(samples[6].sun).toBeCloseTo(samples[0].sun, 8);
  expect(samples[6].moon).toBeCloseTo(samples[0].moon, 8);
  expect(samples[6].sunReflection).toBeCloseTo(samples[0].sunReflection, 8);
  expect(samples[0].shadow).not.toEqual(samples[2].shadow);
  const beamDirectionDelta = Math.hypot(
    samples[3].beamDirection[0] - samples[4].beamDirection[0],
    samples[3].beamDirection[1] - samples[4].beamDirection[1]
  );
  expect(beamDirectionDelta).toBeGreaterThan(.5);
});

test("Voyage landmark meshes remain above their waterlines throughout the full environment cycle", async ({ page }) => {
  const top = await page.locator("#voyage").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.waitForFunction(() => window.__voyageDebug?.().ready, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__voyageDebug().assetsReady, null, { timeout: 180_000 });
  const poses = await page.evaluate((times) => {
    window.__voyageDebug.setIntroTime(5.2);
    return times.map((time) => {
      window.__voyageDebug.setSceneTime(time);
      return window.__voyageDebug().floatingBodies;
    });
  }, Array.from({ length: 21 }, (_, index) => index * 3));
  const landmarkIds = ["docdiff", "neural", "directl", "eva01", "world"];
  for (const pose of poses) {
    for (const id of landmarkIds) {
      expect(pose[id].modelWaterlineOffset).toBeGreaterThan(0);
      expect(pose[id].submergedFraction).toBeLessThanOrEqual(.08);
    }
    expect(pose.boat.modelWaterlineOffset).toBeLessThan(0);
    expect(pose.boat.submergedFraction).toBeLessThanOrEqual(.225);
  }
  expect(Math.max(...poses.map((pose) => pose.boat.submergedFraction))).toBeGreaterThan(.12);
});

test("Voyage semantic nodes remain locked to renderer world projections and the right-rail safe area", async ({ page }) => {
  const top = await page.locator("#voyage").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.waitForFunction(() => window.__voyageDebug?.().ready, null, { timeout: 60_000 });
  await page.evaluate(() => {
    window.__voyageDebug.setIntroTime(5.2);
    window.__voyageDebug.setSceneTime(18);
  });
  const geometry = await page.evaluate(() => {
    const section = document.querySelector("#voyage").getBoundingClientRect();
    const rail = document.querySelector(".voyage-right-rail").getBoundingClientRect();
    const projected = window.__voyageDebug().projectedNodePositions;
    const nodes = [...document.querySelectorAll("[data-voyage-node]")].map((node) => {
      const box = node.getBoundingClientRect();
      const x = box.left + box.width / 2 - section.left;
      const y = box.top + box.height / 2 - section.top;
      return {
        id: node.dataset.voyageNode,
        x,
        y,
        error: Math.hypot(x - projected[node.dataset.voyageNode][0], y - projected[node.dataset.voyageNode][1]),
        left: box.left - section.left,
        right: box.right - section.left
      };
    });
    return { nodes, railLeft: rail.left - section.left, sectionWidth: section.width };
  });
  expect(geometry.nodes.every((node) => node.error <= 2)).toBe(true);
  expect(geometry.nodes.every((node) => node.left >= 0 && node.right < geometry.railLeft)).toBe(true);
  expect(geometry.railLeft).toBeLessThan(geometry.sectionWidth);
});

test("Voyage intro phases are deterministic and first valid input skips without swallowing selection", async ({ page }) => {
  const top = await page.locator("#voyage").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.waitForFunction(() => window.__voyageDebug?.().ready, null, { timeout: 60_000 });
  for (const [seconds, phase] of [[.8, "dissolve"], [2.8, "route-survey"], [4.2, "harbor-reveal"], [5.2, "interactive"]]) {
    await page.evaluate((value) => window.__voyageDebug.setIntroTime(value), seconds);
    expect(await page.evaluate(() => window.__voyageDebug().introPhase)).toBe(phase);
  }
  await page.evaluate(() => window.__voyageDebug.setIntroTime(1.8));
  await page.locator('[data-voyage-node="docdiff"]').click();
  const selected = await page.evaluate(() => window.__voyageDebug());
  expect(selected.introPhase).toBe("interactive");
  expect(selected.introElapsed).toBe(5.2);
  expect(selected.selectedNode).toBe("docdiff");
  expect(selected.evidenceOpen).toBe(true);
});

test("Voyage log and evidence viewer follow node selection while the EVA01 vessel stays at its berth", async ({ page }) => {
  const top = await page.locator("#voyage").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.waitForFunction(() => window.__voyageDebug?.().ready, null, { timeout: 60_000 });
  await page.evaluate(() => {
    window.__voyageDebug.skipIntro();
    // Freeze the expensive model/reflection timeline while this test exercises
    // only the DOM viewer. This also makes the geometry assertions deterministic.
    window.__voyageDebug.setSceneTime(18);
  });
  const docdiff = page.locator('[data-voyage-node="docdiff"]');
  await docdiff.click();
  await expect(page.locator("[data-log-title]")).toHaveText("Document Dock");
  await expect(page.locator("[data-log-entry]")).toHaveText("Entry 00");
  await expect(page.locator("[data-log-copy]")).toContainText("At first light, the archive was sealed");
  await expect(page.locator('[data-project-card="docdiff"]')).toBeVisible();
  expect((await page.evaluate(() => window.__voyageDebug())).boatHeading).toBe(0);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-evidence-panel]")).toHaveAttribute("aria-hidden", "true");
  await page.locator('[data-voyage-node="world"]').click();
  await expect(page.locator("[data-log-title]")).toHaveText("OASIS Gate");
  await expect(page.locator("[data-log-copy]")).toContainText("The chart ends at a green aperture");
  await expect(page.locator("[data-evidence-future]")).toBeVisible();
  expect(Math.abs((await page.evaluate(() => window.__voyageDebug())).boatHeading)).toBeGreaterThan(.2);
  await expect(page.getByRole("link", { name: /Enter Horizon/i }).first()).toBeVisible();
});

test("Voyage freezes while inactive and resumes from the same intro instant", async ({ page }) => {
  test.setTimeout(180_000);
  const voyageTop = await page.locator("#voyage").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), voyageTop);
  await page.waitForFunction(() => window.__voyageDebug?.().ready, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__voyageDebug().running && window.__voyageDebug().introElapsed > .1, null, { timeout: 30_000 });
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(350);
  const frozen = await page.evaluate(() => window.__voyageDebug().introElapsed);
  await page.waitForTimeout(550);
  expect(Math.abs((await page.evaluate(() => window.__voyageDebug().introElapsed)) - frozen)).toBeLessThan(.04);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), voyageTop);
  await page.waitForFunction((before) => window.__voyageDebug().introElapsed > before + .15, frozen, { timeout: 30_000 });
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction(() => !window.__voyageDebug().running);
  const hiddenState = await page.evaluate(() => {
    const state = window.__voyageDebug();
    return { pose: state.floatingBodies.boat, cycle: state.environmentCycleElapsed };
  });
  await page.waitForTimeout(450);
  const hiddenStateAfterWait = await page.evaluate(() => {
    const state = window.__voyageDebug();
    return { pose: state.floatingBodies.boat, cycle: state.environmentCycleElapsed };
  });
  expect(Math.abs(hiddenStateAfterWait.pose.height - hiddenState.pose.height)).toBeLessThan(.0001);
  expect(Math.abs(hiddenStateAfterWait.pose.roll - hiddenState.pose.roll)).toBeLessThan(.0001);
  expect(Math.abs(hiddenStateAfterWait.cycle - hiddenState.cycle)).toBeLessThan(.0001);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction(() => window.__voyageDebug().running);
  await page.waitForFunction((before) => Math.abs(window.__voyageDebug().floatingBodies.boat.height - before) > .001, hiddenState.pose.height, { timeout: 30_000 });
});

test("Voyage falls back per landmark without taking down the unified ocean", async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "dark" });
  const page = await context.newPage();
  await page.route("**/models/landmarks/v3/lighthouse.glb*", (route) => route.abort("failed"));
  await page.route("**/models/landmarks/v2/lighthouse.glb*", (route) => route.abort("failed"));
  await page.route("**/models/landmarks/directl.glb*", (route) => route.abort("failed"));
  await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  const top = await page.locator("#voyage").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.waitForFunction(() => window.__voyageDebug?.().ready, null, { timeout: 60_000 });
  await expect(page.locator('[data-voyage-node="directl"]')).toHaveAttribute("data-asset-state", "poster", { timeout: 90_000 });
  await page.waitForFunction(() => window.__voyageDebug().assetsReady, null, { timeout: 180_000 });
  const debug = await page.evaluate(() => window.__voyageDebug());
  expect(debug.ready).toBe(true);
  expect(debug.landmarkAssets.lighthouse).toBe("poster");
  expect(debug.landmarkAssets.harbor).not.toBe("poster");
  await expect(page.locator('[data-voyage-node="directl"]')).toHaveClass(/is-poster-fallback/);
  await context.close();
});

test("Voyage reflection pass degrades independently to analytic water", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "dark" });
  await context.addInitScript(() => { window.__forceVoyageReflectionFailure = true; });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  const top = await page.locator("#voyage").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.waitForFunction(() => window.__voyageDebug?.().ready, null, { timeout: 60_000 });
  const debug = await page.evaluate(() => window.__voyageDebug());
  expect(debug.ready).toBe(true);
  expect(debug.waterMode).toBe("xz-gerstner");
  expect(debug.reflectionMode).toBe("analytic");
  expect(errors).toEqual([]);
  await context.close();
});

test("desktop Evidence is a complete single-frame viewer inside the lower right rail", async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  const top = await page.locator("#voyage").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.waitForFunction(() => window.__voyageDebug?.().ready, null, { timeout: 60_000 });
  await page.evaluate(() => {
    window.__voyageDebug.skipIntro();
    // The viewer is DOM-only; lock the 3D timeline so layout checks do not
    // compete with the high-quality reflection pass in software WebGL.
    window.__voyageDebug.setSceneTime(18);
  });
  const toggle = page.locator("[data-evidence-toggle]");
  await toggle.focus();
  await toggle.click();
  await expect(page.locator("[data-evidence-panel]")).toHaveAttribute("aria-hidden", "false");
  await page.waitForFunction(() => document.querySelector("[data-evidence-panel]").getBoundingClientRect().height >= 229);
  const geometry = await page.evaluate(() => {
    const rect = (selector) => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
    };
    const panel = rect("[data-evidence-panel]");
    const rail = rect("[data-voyage-right-rail]");
    const log = rect("[data-captains-log]");
    const active = document.querySelector(".evidence-card:not([hidden])");
    const media = active.querySelector("img,video");
    const mediaBox = media.getBoundingClientRect();
    const matteBox = active.querySelector(".evidence-media-matte").getBoundingClientRect();
    const contained = [
      document.querySelector(".evidence-viewer-header"),
      active,
      active.querySelector(".evidence-copy"),
      document.querySelector(".evidence-pager")
    ].every((element) => {
      const box = element.getBoundingClientRect();
      return box.left >= panel.left - 1 && box.right <= panel.right + 1 && box.top >= panel.top - 1 && box.bottom <= panel.bottom + 1;
    });
    return {
      panel,
      rail,
      log,
      contained,
      visibleCards: document.querySelectorAll(".evidence-card:not([hidden])").length,
      objectFit: getComputedStyle(media).objectFit,
      mediaDelta: Math.max(
        Math.abs(mediaBox.left - matteBox.left),
        Math.abs(mediaBox.top - matteBox.top),
        Math.abs(mediaBox.right - matteBox.right),
        Math.abs(mediaBox.bottom - matteBox.bottom)
      ),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      debug: window.__voyageDebug()
    };
  });
  expect(geometry.panel.left).toBeGreaterThanOrEqual(geometry.rail.left);
  expect(geometry.panel.top).toBeGreaterThan(geometry.log.top);
  expect(geometry.panel.bottom).toBeLessThanOrEqual(800);
  expect(geometry.panel.width).toBeLessThan(1280 * .4);
  expect(geometry.contained).toBe(true);
  expect(geometry.visibleCards).toBe(1);
  expect(geometry.objectFit).toBe("contain");
  expect(geometry.mediaDelta).toBeLessThanOrEqual(1);
  expect(geometry.overflow).toBe(0);
  expect(geometry.debug.evidencePlacement).toBe("right-rail");
  expect(geometry.debug.evidenceCount).toBe(1);
  expect(geometry.debug.evidenceIndex).toBe(0);
  await expect(page.locator("[data-evidence-prev]")).toBeDisabled();
  await expect(page.locator("[data-evidence-next]")).toBeDisabled();
  expect(await page.locator("[data-evidence-prev]").getAttribute("tabindex")).toBe("-1");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-evidence-panel]")).toHaveAttribute("aria-hidden", "true");
  await expect(toggle).toBeFocused();
  await context.close();
});

test("Voyage keeps semantic controls and poster art when WebGL2 is unavailable", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "dark" });
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (type === "webgl2") return null;
      return original.call(this, type, ...args);
    };
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  const top = await page.locator("#voyage").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await expect(page.locator("#voyage")).toHaveClass(/voyage-fallback-active/, { timeout: 60_000 });
  await expect(page.locator(".voyage-fallback-art")).toBeVisible();
  await expect(page.locator(".voyage-fallback-art img")).toBeVisible();
  expect(await page.locator(".voyage-fallback-art img").evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole("heading", { name: "THE LUMINOUS WAKE" })).toBeVisible();
  await expect(page.locator("[data-voyage-node]")).toHaveCount(5);
  await expect(page.locator("[data-captains-log]")).toBeVisible();
  await expect(page.locator("[data-voyage-skip]")).toBeHidden();
  await context.close();
});

test("mobile Voyage uses a portrait pixel canvas and a vertical semantic route", async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  const top = await page.locator("#voyage").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.waitForFunction(() => window.__voyageDebug?.().ready, null, { timeout: 60_000 });
  await page.evaluate(() => {
    window.__voyageDebug.skipIntro();
    window.__voyageDebug.setSceneTime(18);
  });
  const debug = await page.evaluate(() => window.__voyageDebug());
  expect(debug.internalResolution[1]).toBe(480);
  expect(debug.internalResolution[0]).toBeLessThan(debug.internalResolution[1]);
  expect(debug.evidencePlacement).toBe("bottom-drawer");
  expect(debug.reflectionMode).toBe("analytic");
  const geometry = await page.evaluate(() => {
    const section = document.querySelector("#voyage").getBoundingClientRect();
    const rail = document.querySelector(".voyage-right-rail").getBoundingClientRect();
    const projected = window.__voyageDebug().projectedNodePositions;
    const nodes = [...document.querySelectorAll("[data-voyage-node]")].map((item) => {
      const box = item.getBoundingClientRect();
      const x = box.left + box.width / 2 - section.left;
      const y = box.top + box.height / 2 - section.top;
      return {
        id: item.dataset.voyageNode,
        x,
        y,
        bottom: box.bottom - section.top,
        error: Math.hypot(x - projected[item.dataset.voyageNode][0], y - projected[item.dataset.voyageNode][1])
      };
    });
    return { nodes, railTop: rail.top - section.top };
  });
  expect(geometry.nodes.every((node) => node.error <= 2)).toBe(true);
  expect(geometry.nodes.every((node, index) => index === 0 || node.y < geometry.nodes[index - 1].y)).toBe(true);
  expect(geometry.nodes.every((node) => node.x >= 45 && node.x <= 345)).toBe(true);
  expect(geometry.nodes.every((node) => node.bottom <= geometry.railTop)).toBe(true);
  await page.locator("[data-evidence-toggle]").click();
  await expect(page.locator("[data-evidence-panel]")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("[data-captains-log]")).toHaveCSS("visibility", "hidden");
  await expect.poll(() => page.locator("[data-evidence-panel]").evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThan(46);
  const evidence = await page.evaluate(() => {
    const box = (element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    };
    const panelElement = document.querySelector("[data-evidence-panel]");
    const active = document.querySelector(".evidence-card:not([hidden])");
    const matteElement = active.querySelector(".evidence-media-matte");
    const mediaElement = active.querySelector("img,video");
    const panel = box(panelElement);
    const matte = box(matteElement);
    const media = box(mediaElement);
    return {
      panel,
      matte,
      media,
      objectFit: getComputedStyle(mediaElement).objectFit,
      visibleCards: document.querySelectorAll(".evidence-card:not([hidden])").length,
      logVisibility: getComputedStyle(document.querySelector("[data-captains-log]")).visibility,
      debug: window.__voyageDebug()
    };
  });
  expect(evidence.panel.left).toBeGreaterThanOrEqual(0);
  expect(evidence.panel.right).toBeLessThanOrEqual(390);
  expect(evidence.panel.top).toBeGreaterThan(46);
  expect(evidence.panel.bottom).toBeLessThanOrEqual(844);
  expect(Math.max(
    Math.abs(evidence.media.left - evidence.matte.left),
    Math.abs(evidence.media.top - evidence.matte.top),
    Math.abs(evidence.media.right - evidence.matte.right),
    Math.abs(evidence.media.bottom - evidence.matte.bottom)
  )).toBeLessThanOrEqual(1);
  expect(evidence.objectFit).toBe("contain");
  expect(evidence.visibleCards).toBe(1);
  expect(evidence.logVisibility).toBe("hidden");
  expect(evidence.debug.evidencePlacement).toBe("bottom-drawer");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await context.close();
});

test("Horizon is one unified renderer with a sprite boat and no legacy visual layers", async ({ page }) => {
  const top = await page.locator("#horizon").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.mouse.move(2, 700);
  await page.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 30_000 });
  await expect(page.locator("[data-horizon-scene]")).toHaveAttribute("data-scene-ready", "true");
  await expect(page.locator(".horizon-stars,.horizon-moon,.oasis-beacon,.horizon-boat,[data-boat-model=horizon]")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "THE END" })).toBeVisible();
  await expect(page.locator(".horizon-chapters li")).toHaveCount(3);
  const debug = await page.evaluate(() => window.__horizonDebug());
  expect(debug.ready).toBe(true);
  expect(debug.atlasReady).toBe(true);
  expect(debug.internalResolution).toEqual([640, 360]);
  expect(debug.targetFps).toBe(60);
  expect([30, 45, 60]).toContain(debug.effectiveFps);
  expect(debug.frameDeltaMs).toBeGreaterThan(0);
  expect(debug.boatScreenPosition[0]).toBeGreaterThan(.60);
  const resources = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name));
  expect(resources.filter((url) => url.includes("research-boat-v1.glb"))).toEqual([]);
});

test("Horizon transition remains scroll-driven without a bridge boat", async ({ page }) => {
  test.setTimeout(120_000);
  const initialTop = await page.locator("#horizon").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value - innerHeight * .86, behavior: "instant" }), initialTop);
  await page.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 30_000 });
  const horizonTop = await page.locator("#horizon").evaluate((element) => element.offsetTop);
  const samples = [];
  for (const screenPosition of [.86, .53, .20]) {
    await page.evaluate(({ top, ratio }) => scrollTo({ top: top - innerHeight * ratio, behavior: "instant" }), { top: horizonTop, ratio: screenPosition });
    await page.waitForTimeout(180);
    samples.push(await page.evaluate(() => ({
      progress: Number(getComputedStyle(document.documentElement).getPropertyValue("--journey-progress"))
    })));
  }
  expect(samples[0].progress).toBeLessThan(samples[1].progress);
  expect(samples[1].progress).toBeLessThan(samples[2].progress);
  await expect(page.locator("[data-journey-bridge]")).toHaveCount(0);
  expect(await page.locator("html").evaluate((element) => element.classList.contains("is-journey-crossing"))).toBe(false);
  expect(await page.evaluate(() => window.__horizonDebug().transitionProgress)).toBeGreaterThan(.95);
});

test("Horizon deterministic meteor hook keeps the rare event testable", async ({ page }) => {
  const top = await page.locator("#horizon").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 30_000 });
  await page.waitForFunction(() => window.__horizonDebug().transitionProgress > .98, null, { timeout: 10_000 });
  await page.evaluate(() => window.__horizonDebug.triggerMeteor("shower"));
  await expect.poll(() => page.evaluate(() => window.__horizonDebug().lastMeteorBatchSize), { timeout: 10_000 }).toBe(8);
  const debug = await page.evaluate(() => window.__horizonDebug());
  expect(debug.lastMeteorBatchSize).toBe(8);
  expect(debug.nextMeteorIn).toBeGreaterThanOrEqual(0);
  expect(debug.meteorOrigins).toHaveLength(8);
  expect(debug.meteorOrigins.every(([x, y]) => x >= .70 && x <= .97 && y >= .70 && y <= .94)).toBe(true);
  expect(debug.meteorVelocities.every(([dx, dy]) => dx < 0 && dy < 0)).toBe(true);
  expect(debug.meteorTailRange[0]).toBeGreaterThanOrEqual(.065);
  expect(debug.meteorTailRange[1]).toBeLessThanOrEqual(.108);
});

test("Horizon launches cinematic fireworks only from a primary canvas tap", async ({ page }) => {
  const top = await page.locator("#horizon").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 30_000 });
  await page.waitForFunction(() => window.__horizonDebug?.().ufoAtlasReady, null, { timeout: 30_000 });
  await page.evaluate(() => window.__horizonDebug.setTime(12));
  const canvas = page.locator("[data-horizon-scene]");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box.x + box.width * .47, box.y + box.height * .24);
  await expect.poll(() => page.evaluate(() => window.__horizonDebug().fireworkCount), { timeout: 30_000 }).toBe(1);
  const cinematic = await page.evaluate(() => window.__horizonDebug());
  expect(cinematic.fireworkEventCount).toBeGreaterThanOrEqual(8);
  expect(cinematic.fireworkEventCount).toBeLessThanOrEqual(11);
  expect(cinematic.fireworkPrincipalCount).toBeGreaterThanOrEqual(3);
  expect(cinematic.fireworkPrincipalCount).toBeLessThanOrEqual(4);
  expect(cinematic.fireworkCompanionCount).toBeGreaterThanOrEqual(5);
  expect(cinematic.fireworkCompanionCount).toBeLessThanOrEqual(7);
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
  await page.evaluate(() => window.__horizonDebug.setTime(12));
  expect(await page.evaluate(() => window.__horizonDebug().fireworkCount)).toBe(3);
});

test("Horizon UFO cycle has deterministic stages and returns the boat to its origin", async ({ page }) => {
  const top = await page.locator("#horizon").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 30_000 });
  await page.waitForFunction(() => window.__horizonDebug?.().ufoAtlasReady, null, { timeout: 30_000 });
  const phases = [
    [38.2, "ufo-emerging"], [39.2, "ufo-approaching"], [40.3, "beam-opening"], [41.2, "abducting"],
    [42.2, "returning-to-moon"], [43.4, "moon-transfer"], [44.0, "boat-respawning"], [44.5, "boat-splashdown"], [46.0, "restart-pause"]
  ];
  for (const [seconds, phase] of phases) {
    await page.evaluate((value) => window.__horizonDebug.setTime(value), seconds);
    expect(await page.evaluate(() => window.__horizonDebug().boatCyclePhase)).toBe(phase);
  }
  await page.evaluate(() => window.__horizonDebug.setTime(41.7));
  const lifted = await page.evaluate(() => window.__horizonDebug());
  expect(lifted.boatLift).toBeGreaterThan(0);
  expect(lifted.beamStrength).toBeGreaterThan(0);
  expect(lifted.boatScreenPosition[1]).toBeLessThan(lifted.horizonScreenY);
  expect(lifted.boatVisible).toBeGreaterThan(.9);
  await page.evaluate(() => window.__horizonDebug.setTime(44.3));
  const falling = await page.evaluate(() => window.__horizonDebug());
  expect(falling.boatVerticalVelocity).toBeLessThan(0);
  expect(falling.boatLift).toBe(1);
  await page.evaluate(() => window.__horizonDebug.setTime(44.76));
  const impact = await page.evaluate(() => window.__horizonDebug());
  expect(impact.splashStrength).toBeGreaterThan(0);
  expect(Math.abs(impact.boatPitch)).toBeGreaterThan(0);
  await page.evaluate(() => window.__horizonDebug.setTime(47.8));
  const restarted = await page.evaluate(() => window.__horizonDebug());
  expect(restarted.boatCyclePhase).toBe("sailing");
  expect(restarted.boatScreenPosition[0]).toBeLessThan(.63);
});

test("Horizon moon road and oil lamp expose stable debug signals", async ({ page }) => {
  const top = await page.locator("#horizon").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 30_000 });
  await page.evaluate(() => window.__horizonDebug.setTime(12));
  const first = await page.evaluate(() => window.__horizonDebug());
  await page.evaluate(() => window.__horizonDebug.setTime(12.23));
  const second = await page.evaluate(() => window.__horizonDebug());
  expect(first.moonReflectionStrength).toBeGreaterThan(.35);
  expect(first.boatLampStrength).toBeGreaterThanOrEqual(.62);
  expect(first.boatLampStrength).toBeLessThanOrEqual(1);
  expect(second.boatLampStrength).not.toBe(first.boatLampStrength);
});

test("Horizon keeps the sea live when the optional UFO atlas cannot load", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "dark" });
  const page = await context.newPage();
  let ufoRequestAborted = false;
  await page.route("**/ufo-atlas.png", (route) => {
    ufoRequestAborted = true;
    return route.abort("failed");
  });
  await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  const top = await page.locator("#horizon").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 30_000 });
  await expect.poll(() => ufoRequestAborted, { timeout: 30_000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__horizonDebug().ufoAtlasReady), { timeout: 30_000 }).toBe(false);
  const debug = await page.evaluate(() => window.__horizonDebug());
  expect(debug.atlasReady).toBe(true);
  expect(debug.moonReflectionStrength).toBeGreaterThan(0);
  await context.close();
});

test("Horizon navigation recedes after settling and returns for keyboard focus", async ({ page }) => {
  test.setTimeout(60_000);
  const top = await page.locator("#horizon").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await page.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 30_000 });
  const nav = page.locator(".chapter-nav");
  await page.evaluate(() => new Promise((resolve) => {
    let idleTimer = 0;
    const finish = () => {
      window.removeEventListener("scroll", onScroll);
      resolve();
    };
    const onScroll = () => {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(finish, 350);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }));
  await nav.hover();
  await page.mouse.move(2, 700);
  await expect(page.locator("html")).toHaveClass(/horizon-ui-settled/, { timeout: 8_000 });
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
  await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  const top = await page.locator("#horizon").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
  await expect(page.locator("#horizon")).toHaveClass(/horizon-fallback-active/);
  await expect(page.locator(".horizon-fallback")).toBeVisible();
  await expect(page.getByRole("heading", { name: "THE END" })).toBeVisible();
  await context.close();
});

test("mobile Horizon uses an aspect-correct internal canvas and includes the boat", async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Zongyuan Yang" }).waitFor();
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

test("mobile gallery keeps all four project targets aligned and inside the viewport", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Zongyuan Yang" }).waitFor();
  await expect(page.locator("[data-playcanvas-gallery]")).toBeVisible({ timeout: 30_000 });
  await page.locator(".gallery-stage").evaluate((element) => element.scrollIntoView({ block: "start", behavior: "instant" }));
  const geometry = await page.locator(".gallery-overlay").evaluate((overlay) => {
    const parent = overlay.getBoundingClientRect();
    const cards = [...overlay.querySelectorAll(".gallery-ui-card")].map((card) => {
      const rect = card.getBoundingClientRect();
      return { id: card.getAttribute("data-project"), left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    });
    const overlaps = cards.flatMap((a, index) => cards.slice(index + 1).map((b) => (
      Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
      * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
    )));
    return {
      parent: { left: parent.left, top: parent.top, right: parent.right, bottom: parent.bottom },
      cards,
      overlaps,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    };
  });
  expect(geometry.cards.map((card) => card.id)).toEqual(["ssat", "directl", "eva01", "docdiff"]);
  expect(geometry.overlaps.every((area) => area === 0)).toBe(true);
  expect(geometry.cards.every((card) => card.left >= geometry.parent.left && card.right <= geometry.parent.right && card.top >= geometry.parent.top && card.bottom <= geometry.parent.bottom)).toBe(true);
  expect(geometry.scrollWidth).toBe(geometry.clientWidth);
  for (const id of ["ssat", "directl", "eva01", "docdiff"]) {
    const card = page.locator(`.gallery-ui-card[data-project="${id}"]`);
    await card.dispatchEvent("click");
    await expect(card).toHaveClass(/is-active/);
    await expect(page.locator(".gallery-ui-card.is-active")).toHaveCount(1);
  }
  await context.close();
});

test("reduced motion exposes the static final state", async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Zongyuan Yang" }).waitFor();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await expect(page.getByRole("heading", { name: "Zongyuan Yang" })).toBeVisible();
  await expect(page.locator("[data-siggraph-machine]")).toHaveAttribute("data-result", "3");
  await expect(page.locator("[data-terminal-state]")).toHaveText("FOLLOW");
  await expect(page.locator(".terminal-line")).toHaveCount(7);
  const voyageTop = await page.locator("#voyage").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), voyageTop);
  await page.waitForFunction(() => window.__voyageDebug?.().ready, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__voyageDebug().assetsReady, null, { timeout: 180_000 });
  const voyage = await page.evaluate(() => window.__voyageDebug());
  expect(voyage.introPhase).toBe("interactive");
  expect(voyage.introElapsed).toBe(5.2);
  expect(voyage.selectedNode).toBe("eva01");
  expect(voyage.running).toBe(false);
  expect(voyage.evidenceOpen).toBe(false);
  expect(voyage.cameraProjection).toBe("perspective");
  expect(voyage.waterMode).toBe("xz-gerstner");
  expect(voyage.evidencePlacement).toBe("right-rail");
  expect(voyage.environmentPhase).toBe("morning");
  expect(voyage.environmentCycleElapsed).toBe(6);
  expect(voyage.sunStrength).toBeGreaterThan(voyage.moonStrength);
  const reducedPose = voyage.floatingBodies.boat;
  const reducedBeamDirection = voyage.lighthouseBeamDirection;
  await page.waitForTimeout(350);
  const reducedStateAfterWait = await page.evaluate(() => window.__voyageDebug());
  const reducedPoseAfterWait = reducedStateAfterWait.floatingBodies.boat;
  expect(reducedPoseAfterWait.height).toBeCloseTo(reducedPose.height, 6);
  expect(reducedPoseAfterWait.pitch).toBeCloseTo(reducedPose.pitch, 6);
  expect(reducedPoseAfterWait.roll).toBeCloseTo(reducedPose.roll, 6);
  expect(reducedStateAfterWait.environmentCycleElapsed).toBe(6);
  expect(reducedStateAfterWait.lighthouseBeamDirection).toEqual(reducedBeamDirection);
  const horizonTop = await page.locator("#horizon").evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), horizonTop);
  await page.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 30_000 });
  const horizon = await page.evaluate(() => window.__horizonDebug());
  expect(horizon.transitionProgress).toBe(1);
  expect(horizon.boatProgress).toBe(1);
  expect(horizon.meteorCount).toBe(0);
  await expect(page.locator("[data-journey-bridge]")).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  await context.close();
});
