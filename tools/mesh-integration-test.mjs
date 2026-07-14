import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const out = "/tmp/royalvice-mesh-integration";
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, colorScheme: "dark" });
const consoleErrors = [];
const consoleWarnings = [];
const pageErrors = [];
const glbResponses = [];

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
  if (message.type() === "warning") consoleWarnings.push(message.text());
});
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("response", (response) => {
  if (response.url().includes(".glb")) glbResponses.push({ url: response.url(), status: response.status() });
});

await page.goto("http://127.0.0.1:5173", { waitUntil: "networkidle", timeout: 180_000 });
await page.locator("#hero-exhibits.is-ready").waitFor({ timeout: 180_000 });
await page.waitForFunction(
  () => Object.values(window.__galleryDebug?.().generatedTrophyModels ?? {}).filter(Boolean).length === 4,
  null,
  { timeout: 180_000 }
);
await page.waitForTimeout(2_000);

const scrollToSection = async (id) => {
  const top = await page.locator(`#${id}`).evaluate((element) => element.offsetTop);
  await page.evaluate((value) => scrollTo({ top: value, behavior: "instant" }), top);
};

await scrollToSection("profile");
await page.waitForTimeout(1_000);
await page.screenshot({ path: `${out}/01-profile-generated-trophies.png` });
const galleryDebug = await page.evaluate(() => window.__galleryDebug?.() ?? null);

await scrollToSection("voyage");
await page.waitForFunction(
  () => document.querySelector('[data-boat-model="sunset"]')?.closest(".research-boat")?.classList.contains("is-model-ready"),
  null,
  { timeout: 120_000 }
);
await page.waitForTimeout(1_000);
await page.screenshot({ path: `${out}/02-voyage-generated-boat.png` });

await scrollToSection("horizon");
await page.waitForFunction(
  () => document.querySelector('[data-boat-model="horizon"]')?.closest(".research-boat")?.classList.contains("is-model-ready"),
  null,
  { timeout: 120_000 }
);
await page.waitForTimeout(1_000);
await page.screenshot({ path: `${out}/03-horizon-generated-boat.png` });

const boats = await page.evaluate(() => [...document.querySelectorAll("[data-boat-model]")].map((canvas) => {
  const host = canvas.closest(".research-boat");
  const rect = canvas.getBoundingClientRect();
  const svg = host?.querySelector("svg");
  const gl = canvas.getContext("webgl2");
  const corner = new Uint8Array(4);
  gl?.readPixels(1, 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, corner);
  return {
    preset: canvas.dataset.boatModel,
    ready: host?.classList.contains("is-model-ready") ?? false,
    fallback: host?.classList.contains("is-model-fallback") ?? false,
    cssSize: [Math.round(rect.width), Math.round(rect.height)],
    bufferSize: [canvas.width, canvas.height],
    opacity: getComputedStyle(canvas).opacity,
    backgroundColor: getComputedStyle(canvas).backgroundColor,
    contextAlpha: gl?.getContextAttributes()?.alpha ?? null,
    cornerPixel: [...corner],
    svgOpacity: svg ? getComputedStyle(svg).opacity : null
  };
}));

const result = {
  galleryDebug,
  boats,
  glbResponses,
  consoleErrors,
  consoleWarnings,
  pageErrors,
  scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth),
  clientWidth: await page.evaluate(() => document.documentElement.clientWidth)
};

await writeFile(`${out}/integration-result.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
