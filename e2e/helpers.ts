import type { Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

function hasSavedAuth(role: "admin" | "teacher"): boolean {
  return fs.existsSync(path.join("e2e", ".auth", `${role}.json`));
}

export function adminCreds() {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  return email && password ? { email, password } : null;
}

export function teacherCreds() {
  const email = process.env.E2E_TEACHER_EMAIL;
  const password = process.env.E2E_TEACHER_PASSWORD;
  return email && password ? { email, password } : null;
}

/**
 * Ensures the page is logged in as the requested role. If a saved storage
 * state exists (via `node e2e/capture-auth.mjs <role>`), it's already loaded
 * by Playwright at context creation time and we just navigate to the landing
 * page. Otherwise we fall back to the form login, which requires the
 * E2E_<ROLE>_EMAIL / PASSWORD env vars.
 */
export async function ensureLoggedIn(
  page: Page,
  role: "admin" | "teacher",
  landingPath: string,
) {
  if (hasSavedAuth(role)) {
    await page.goto(landingPath);
    return;
  }
  const creds = role === "admin" ? adminCreds() : teacherCreds();
  if (!creds) {
    throw new Error(
      `No saved session at e2e/.auth/${role}.json and no E2E_${role.toUpperCase()}_EMAIL / ` +
        `E2E_${role.toUpperCase()}_PASSWORD in env. Run:\n` +
        `  node e2e/capture-auth.mjs ${role}\n` +
        `to log in once and save a session.`,
    );
  }
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(creds.email);
  await page.getByLabel(/password/i).fill(creds.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(`**${landingPath}**`, { timeout: 15_000 });
}

/** Take a screenshot to a stable, predictable filename for the review folder. */
export async function snap(page: Page, name: string) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.screenshot({
    path: `e2e/screenshots/${name}.png`,
    fullPage: true,
  });
}
