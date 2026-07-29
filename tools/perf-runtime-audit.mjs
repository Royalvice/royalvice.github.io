import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const DEFAULT_URL = "http://127.0.0.1:4173";
const DEFAULT_OUTPUT = "artifacts/performance/runtime-audit.json";
let browser = null;
let context = null;

function readArgument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function number(value) {
  return Math.round(value * 100) / 100;
}

async function browserMetrics(session) {
  const { metrics } = await session.send("Performance.getMetrics");
  return Object.fromEntries(metrics
    .filter((metric) => ["TaskDuration", "ScriptDuration", "LayoutDuration", "RecalcStyleDuration", "JSHeapUsedSize", "JSHeapTotalSize", "Nodes", "JSEventListeners"].includes(metric.name))
    .map((metric) => [metric.name, number(metric.value)]));
}

async function sampleRaf(page, duration = 1_600) {
  return page.evaluate((sampleDuration) => new Promise((resolveSample) => {
    const intervals = [];
    let frames = 0;
    let first = 0;
    let previous = 0;
    const sample = (timestamp) => {
      if (!first) first = timestamp;
      if (previous) intervals.push(timestamp - previous);
      previous = timestamp;
      frames += 1;
      if (timestamp - first >= sampleDuration) {
        const sorted = [...intervals].sort((a, b) => a - b);
        const percentile = (fraction) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
        const elapsed = Math.max(1, timestamp - first);
        resolveSample({
          frames,
          elapsedMs: Math.round(elapsed),
          fps: Math.round(frames * 1_000 / elapsed * 100) / 100,
          medianFrameMs: Math.round(percentile(.5) * 100) / 100,
          p95FrameMs: Math.round(percentile(.95) * 100) / 100,
          framesOver33ms: intervals.filter((interval) => interval > 33.34).length,
          framesOver50ms: intervals.filter((interval) => interval > 50).length
        });
        return;
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }), duration);
}

async function snapshot(page, session, label) {
  const [raf, metrics, diagnostics] = await Promise.all([
    sampleRaf(page),
    browserMetrics(session),
    page.evaluate(() => ({
      activeSection: document.documentElement.dataset.section,
      canvasCount: document.querySelectorAll("canvas").length,
      gallery: typeof window.__galleryDebug === "function" ? window.__galleryDebug() : null,
      voyage: typeof window.__voyageDebug === "function" ? window.__voyageDebug() : null,
      horizon: typeof window.__horizonDebug === "function" ? window.__horizonDebug() : null,
      profileAdventure: window.__profileAdventureDebug?.getState?.() ?? null,
      longTasks: window.__runtimeAudit?.longTasks ?? [],
      layoutShift: window.__runtimeAudit?.layoutShift ?? 0
    }))
  ]);
  return { label, raf, metrics, diagnostics };
}

async function scrollToSection(page, id) {
  await page.locator(`#${id}`).evaluate((section) => section.scrollIntoView({ behavior: "instant", block: "start" }));
  await page.waitForTimeout(180);
}

async function main() {
  const url = readArgument("--url", DEFAULT_URL);
  const output = resolve(readArgument("--output", DEFAULT_OUTPUT));
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    colorScheme: "dark",
    deviceScaleFactor: 1
  });
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  await session.send("Performance.enable");
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.addInitScript(() => {
    const audit = { longTasks: [], layoutShift: 0 };
    window.__runtimeAudit = audit;
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          audit.longTasks.push({ startTime: Math.round(entry.startTime), duration: Math.round(entry.duration) });
        }
      }).observe({ type: "longtask", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) audit.layoutShift += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {
      // Browsers without PerformanceObserver support still produce renderer and rAF data.
    }
  });

  const startedAt = Date.now();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  process.stderr.write("[audit] profile shell loaded\\n");
  await page.getByRole("heading", { name: "Zongyuan Yang" }).waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => typeof window.__galleryDebug === "function", null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__profileAdventureDebug?.getState?.().ready, null, { timeout: 60_000 });
  process.stderr.write("[audit] profile renderers ready\\n");
  const stages = [];
  stages.push(await snapshot(page, session, "profile-active"));

  await scrollToSection(page, "voyage");
  process.stderr.write("[audit] voyage requested\\n");
  await page.waitForFunction(() => window.__voyageDebug?.().ready, null, { timeout: 90_000 });
  await page.waitForFunction(() => window.__voyageDebug?.().assetsReady, null, { timeout: 180_000 });
  process.stderr.write("[audit] voyage assets ready\\n");
  stages.push(await snapshot(page, session, "voyage-active-assets-ready"));

  await scrollToSection(page, "horizon");
  process.stderr.write("[audit] horizon requested\\n");
  await page.waitForFunction(() => window.__horizonDebug?.().ready, null, { timeout: 90_000 });
  process.stderr.write("[audit] horizon renderer ready\\n");
  stages.push(await snapshot(page, session, "horizon-active"));

  const resources = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => ({
    name: entry.name,
    initiatorType: entry.initiatorType,
    duration: Math.round(entry.duration),
    transferSize: entry.transferSize,
    decodedBodySize: entry.decodedBodySize
  })));
  const summary = resources.reduce((groups, entry) => {
    const key = entry.initiatorType || "other";
    const group = groups[key] ?? { count: 0, transferSize: 0, decodedBodySize: 0, duration: 0 };
    group.count += 1;
    group.transferSize += entry.transferSize;
    group.decodedBodySize += entry.decodedBodySize;
    group.duration = Math.max(group.duration, entry.duration);
    groups[key] = group;
    return groups;
  }, {});
  const report = {
    url,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    consoleErrors,
    stages,
    resourceSummary: summary,
    largestResources: resources.sort((a, b) => b.transferSize - a.transferSize).slice(0, 25)
  };
  await mkdir(resolve(output, ".."), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    output,
    durationMs: report.durationMs,
    consoleErrors: consoleErrors.length,
    stageRaf: stages.map((stage) => ({ label: stage.label, ...stage.raf })),
    resourceSummary: summary
  }, null, 2)}\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await context?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  });
