import { test } from "@playwright/test";
import { snap } from "./helpers";

// Student portal walkthrough. Logs in as Aisha (seeded via
// prisma/seed-demo-student-login.ts) so the auth state file the other tours
// rely on (admin.json) isn't used here — we run a fresh form login each
// time. Credentials read from E2E_STUDENT_EMAIL / E2E_STUDENT_PASSWORD env.

test.describe("Student tour @student", () => {
  test("desktop walkthrough", async ({ page }) => {
    const email = process.env.E2E_STUDENT_EMAIL;
    const password = process.env.E2E_STUDENT_PASSWORD;
    if (!email || !password) {
      test.skip(
        true,
        "Set E2E_STUDENT_EMAIL + E2E_STUDENT_PASSWORD in .env.local to run the student tour.",
      );
    }

    await page.goto("/login");
    await page.getByLabel(/email/i).fill(email!);
    await page.getByLabel(/password/i).fill(password!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/student/, { timeout: 15_000 });

    await snap(page, "student-01-home");

    await page.goto("/student/schedule");
    await page.waitForLoadState("networkidle").catch(() => {});
    await snap(page, "student-02-schedule");

    await page.goto("/student/payments");
    await page.waitForLoadState("networkidle").catch(() => {});
    await snap(page, "student-03-payments");

    // If a SUBMITTED exam exists for this student, the result page is reachable
    // via the View result link on the schedule. Best-effort.
    await page.goto("/student/schedule");
    const resultLink = page.getByRole("link", { name: /view result/i }).first();
    if (await resultLink.isVisible().catch(() => false)) {
      await resultLink.click();
      await page.waitForLoadState("networkidle").catch(() => {});
      await snap(page, "student-04-exam-result");
    }
  });
});
