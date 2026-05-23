import { test } from "@playwright/test";
import { ensureLoggedIn, snap } from "./helpers";

test.describe("Teacher tour @teacher", () => {
  test("desktop walkthrough", async ({ page }) => {
    await ensureLoggedIn(page, "teacher", "/teacher");
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

      // Exam-schedule section landed on /teacher/batches/[id] — walk back
      // to the batch page and snap it (the section sits below the sessions
      // grid). Then try to follow the Grade link if one exists.
      await page.goto(firstBatchLink ? "/teacher" : "/teacher");
      const reopenBatch = page.locator('a[href^="/teacher/batches/"]').first();
      if (await reopenBatch.isVisible().catch(() => false)) {
        const href = await reopenBatch.getAttribute("href");
        if (href) {
          await page.goto(href);
          await page.waitForLoadState("networkidle").catch(() => {});
          await snap(page, "teacher-05-batch-with-exams");

          const gradeLink = page.getByRole("link", { name: /^grade$/i }).first();
          if (await gradeLink.isVisible().catch(() => false)) {
            await gradeLink.click();
            await page.waitForLoadState("networkidle").catch(() => {});
            await snap(page, "teacher-06-grade-queue");
          }
        }
      }
    }

    // Teacher profile — reachable via the avatar+name link in the header.
    await page.goto("/teacher/profile");
    await page.waitForLoadState("networkidle").catch(() => {});
    await snap(page, "teacher-07-profile");
  });
});
