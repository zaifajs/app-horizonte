// One-shot helper to capture a logged-in browser session for the Playwright
// tour. Usage:
//   node e2e/capture-auth.mjs admin
//   node e2e/capture-auth.mjs teacher
//
// Opens a Chromium window, navigates to /login, and waits for you to sign in
// by hand. Once the URL leaves /login the session is saved to e2e/.auth/<role>.json
// and the browser closes. The tour specs (admin-tour, teacher-tour, mobile-tour)
// pick that file up automatically next time you run `npm run e2e`.

import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const role = process.argv[2];
if (!role || !["admin", "teacher"].includes(role)) {
  console.error('Usage: node e2e/capture-auth.mjs <admin|teacher>');
  process.exit(1);
}

// Allow override via env, default to staging.
const BASE_URL =
  process.env.E2E_BASE_URL ??
  (fs.existsSync(".env.local")
    ? (fs
        .readFileSync(".env.local", "utf8")
        .split("\n")
        .find((l) => l.startsWith("E2E_BASE_URL="))
        ?.split("=")[1]
        ?.replace(/^"|"$/g, "") ?? "https://stage.nhorizonte.pt")
    : "https://stage.nhorizonte.pt");

const authDir = path.join("e2e", ".auth");
fs.mkdirSync(authDir, { recursive: true });
const statePath = path.join(authDir, `${role}.json`);

console.log(`\n→ Opening ${BASE_URL}/login in a Chromium window…`);
console.log(`  Sign in as your ${role} account.`);
console.log(`  The window closes automatically once you reach a logged-in page.`);
console.log(`  Session will be saved to ${statePath}\n`);

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(`${BASE_URL}/login`);

// Poll until the URL leaves /login — i.e. you've successfully signed in.
let url = page.url();
while (url.includes("/login") || url.includes("/auth/")) {
  await page.waitForTimeout(500);
  if (page.isClosed()) {
    console.error("\n× Window closed before login completed.");
    await browser.close().catch(() => {});
    process.exit(1);
  }
  url = page.url();
}

// Let the post-login page settle (cookies set, etc.) before grabbing state.
await page.waitForTimeout(1500);
await context.storageState({ path: statePath });
console.log(`\n✓ Captured ${role} session → ${statePath}`);
console.log(`  Now run:  npm run e2e:${role}\n`);
await browser.close();
