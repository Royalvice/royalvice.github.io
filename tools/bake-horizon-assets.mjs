import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const port = 4199;
const output = new URL("../public/assets/horizon/", import.meta.url);

function decodeDataUrl(value) {
  return Buffer.from(value.slice(value.indexOf(",") + 1), "base64");
}

async function waitForServer(url, timeout = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

const server = spawn("npm", ["run", "dev", "--", "--port", String(port)], {
  cwd: new URL("..", import.meta.url),
  stdio: ["ignore", "pipe", "pipe"]
});

try {
  await waitForServer(`http://127.0.0.1:${port}/tools/horizon-boat-baker.html`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 1 });
  page.on("console", (message) => {
    if (message.type() === "error") process.stderr.write(`${message.text()}\n`);
  });
  await page.goto(`http://127.0.0.1:${port}/tools/horizon-boat-baker.html`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__horizonBakeResult || window.__horizonBakeError, null, { timeout: 90_000 });
  const result = await page.evaluate(() => {
    if (window.__horizonBakeError) throw new Error(window.__horizonBakeError);
    return window.__horizonBakeResult;
  });
  await mkdir(output, { recursive: true });
  await Promise.all([
    writeFile(new URL("research-boat-night-atlas.png", output), decodeDataUrl(result.atlasPng)),
    writeFile(new URL("research-boat-night-atlas.webp", output), decodeDataUrl(result.atlasWebp)),
    writeFile(new URL("blue-noise-128.png", output), decodeDataUrl(result.noisePng)),
    writeFile(new URL("blue-noise-128.webp", output), decodeDataUrl(result.noiseWebp))
  ]);
  await browser.close();
} finally {
  server.kill("SIGTERM");
}
