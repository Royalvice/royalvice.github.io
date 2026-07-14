import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const out = "/tmp/royalvice-mesh-integration";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });

const desktop = await browser.newPage({ viewport: { width: 1920, height: 1080 }, colorScheme: "dark" });
const consoleErrors = [];
desktop.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
await desktop.route("**/trophy-ssat-v1.glb*", (route) => route.abort("failed"));
await desktop.route("**/research-boat-v1.glb*", (route) => route.abort("failed"));
await desktop.goto("http://127.0.0.1:5173", { waitUntil: "networkidle", timeout: 180_000 });
await desktop.locator("#hero-exhibits.is-ready").waitFor({ timeout: 180_000 });
await desktop.waitForFunction(() => {
  const models = window.__galleryDebug?.().generatedTrophyModels ?? {};
  return models.ssat === false && models.directl === true && models.eva01 === true && models.docdiff === true;
}, null, { timeout: 180_000 });
const profileFallbackDebug = await desktop.evaluate(() => window.__galleryDebug?.());
await desktop.screenshot({ path: `${out}/04-profile-one-trophy-fallback.png` });

await desktop.getByRole("link", { name: /Voyage/i }).click();
await desktop.waitForFunction(
  () => document.querySelector('[data-boat-model="sunset"]')?.closest(".research-boat")?.classList.contains("is-model-fallback"),
  null,
  { timeout: 60_000 }
);
const desktopBoatFallback = await desktop.evaluate(() => {
  const canvas = document.querySelector('[data-boat-model="sunset"]');
  const host = canvas?.closest(".research-boat");
  const svg = host?.querySelector("svg");
  return {
    fallback: host?.classList.contains("is-model-fallback") ?? false,
    modelReady: host?.classList.contains("is-model-ready") ?? false,
    canvasDisplay: canvas ? getComputedStyle(canvas).display : null,
    svgOpacity: svg ? getComputedStyle(svg).opacity : null
  };
});
await desktop.screenshot({ path: `${out}/05-voyage-boat-fallback.png` });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });
let mobileBoatRequests = 0;
mobile.on("request", (request) => {
  if (request.url().includes("research-boat-v1.glb")) mobileBoatRequests += 1;
});
await mobile.goto("http://127.0.0.1:5173", { waitUntil: "domcontentloaded", timeout: 120_000 });
await mobile.getByRole("link", { name: /Voyage/i }).click();
await mobile.waitForTimeout(1_500);
const mobileBoat = await mobile.evaluate(() => {
  const canvas = document.querySelector('[data-boat-model="sunset"]');
  const host = canvas?.closest(".research-boat");
  const svg = host?.querySelector("svg");
  return {
    canvasDisplay: canvas ? getComputedStyle(canvas).display : null,
    modelReady: host?.classList.contains("is-model-ready") ?? false,
    svgOpacity: svg ? getComputedStyle(svg).opacity : null,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  };
});

const result = {
  profileFallbackModels: profileFallbackDebug.generatedTrophyModels,
  desktopBoatFallback,
  mobileBoatRequests,
  mobileBoat,
  consoleErrors
};
await writeFile(`${out}/fallback-result.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
