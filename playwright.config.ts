import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  use: {
    browserName: "chromium",
    baseURL: "http://127.0.0.1:1422",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev --host 127.0.0.1 --port 1422",
    url: "http://127.0.0.1:1422/tests/numeric-input.html",
  },
});
