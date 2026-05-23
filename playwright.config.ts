import { defineConfig, devices } from "@playwright/test";
import * as fs from "node:fs";

// Load .env.local manually if present — keeps E2E credentials out of git.
const envPath = ".env.local";
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      let value = m[2];
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      process.env[m[1]] = value;
    }
  }
}

const BASE_URL = process.env.E2E_BASE_URL ?? "https://stage.nhorizonte.pt";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // Sequential — we hit a shared staging DB.
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: "admin",
      use: { ...devices["Desktop Chrome"] },
      grep: /@admin/,
    },
    {
      name: "teacher",
      use: { ...devices["Desktop Chrome"] },
      grep: /@teacher/,
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 14"] },
      grep: /@mobile/,
    },
  ],
  outputDir: "test-results/",
});
