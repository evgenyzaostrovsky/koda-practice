import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:8011", headless: true, trace: "retain-on-failure" },
  webServer: {
    command: "node scripts/python.mjs -m uvicorn app.main:app --app-dir apps/api --host 127.0.0.1 --port 8011",
    url: "http://127.0.0.1:8011/api/health",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
