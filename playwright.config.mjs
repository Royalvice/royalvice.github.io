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
    viewport: { width: 1920, height: 1080 },
    colorScheme: "dark",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm run dev -- --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 60_000
  }
});
