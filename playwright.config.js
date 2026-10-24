import { defineConfig } from "@playwright/test";
import os from "node:os";
import path from "node:path";
export default defineConfig({
  testDir: "./tests",
  testMatch: "ui.spec.js",
  workers: 1,
  timeout: 90000,
  outputDir: path.join(os.tmpdir(), "questionnaire-playwright"),
  use: {
    actionTimeout: 15000,
    navigationTimeout: 20000,
    baseURL: process.env.TEST_UI_ORIGIN || "http://localhost:5173",
    channel: "chrome",
    headless: true,
    viewport: { width: 1536, height: 1024 },
  },
  reporter: "list",
});
