import type { Page } from "@playwright/test";

export function adminCreds() {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD in .env.local (or env) before running the admin tour.",
    );
  }
  return { email, password };
}

export function teacherCreds() {
  const email = process.env.E2E_TEACHER_EMAIL;
  const password = process.env.E2E_TEACHER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Set E2E_TEACHER_EMAIL and E2E_TEACHER_PASSWORD in .env.local (or env) before running the teacher tour.",
    );
  }
  return { email, password };
}

/**
 * Logs in via the /login form. The form is server-side rendered with a
 * single email + password field. Waits for navigation to the post-login
 * landing page.
 */
export async function login(
  page: Page,
  creds: { email: string; password: string },
  expectedPath: string,
) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(creds.email);
  await page.getByLabel(/password/i).fill(creds.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(`**${expectedPath}**`, { timeout: 15_000 });
}

/** Take a screenshot to a stable, predictable filename for the review folder. */
export async function snap(page: Page, name: string) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.screenshot({
    path: `e2e/screenshots/${name}.png`,
    fullPage: true,
  });
}
