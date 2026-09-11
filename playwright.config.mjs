import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "./tests",
  outputDir: "/tmp/royalvice-playwright-results",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    headless: true,
    // The macOS headless shell defaults to SwiftShader, which stalls these
    // real-time scenes. Exercise the same Metal backend as a local browser.
    launchOptions: { args: process.env.ARCADE_SOFTWARE_RENDERING ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : process.platform === "darwin" ? ["--use-angle=metal"] : [] },
    viewport: process.env.ARCADE_SOFTWARE_RENDERING ? { width: 960, height: 720 } : { width: 1920, height: 1080 },
    deviceScaleFactor: process.env.ARCADE_SOFTWARE_RENDERING ? 0.5 : 1,
    colorScheme: "dark",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm run dev -- --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
});
