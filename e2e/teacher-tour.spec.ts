import { test } from "@playwright/test";
import { teacherCreds, login, snap } from "./helpers";

test.describe("Teacher tour @teacher", () => {
  test("desktop walkthrough", async ({ page }) => {
    await login(page, teacherCreds(), "/teacher");
    await snap(page, "teacher-01-landing");

    // Open the first assigned batch
    const firstBatchLink = page.locator('a[href^="/teacher/batches/"]').first();
    if (await firstBatchLink.isVisible().catch(() => false)) {
      await firstBatchLink.click();
      await page.waitForLoadState("networkidle").catch(() => {});
      await snap(page, "teacher-02-batch");

      // Try to find a session — prefer today's highlighted one if it exists
      const firstSession = page.locator('a[href^="/teacher/sessions/"]').first();
      if (await firstSession.isVisible().catch(() => false)) {
        await firstSession.click();
        await page.waitForLoadState("networkidle").catch(() => {});
        await snap(page, "teacher-03-session-attendance");
      }

      await page.goBack();
      const attendanceLink = page
        .getByRole("link", { name: /attendance/i })
        .first();
      if (await attendanceLink.isVisible().catch(() => false)) {
        await attendanceLink.click();
        await snap(page, "teacher-04-batch-attendance-matrix");
      }
    }
  });
});
