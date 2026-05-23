import { test } from "@playwright/test";
import { adminCreds, teacherCreds, login, snap } from "./helpers";

test.describe("Mobile tour @mobile", () => {
  test("admin on phone", async ({ page }) => {
    await login(page, adminCreds(), "/admin/today");
    await snap(page, "mobile-admin-01-today");

    await page.goto("/admin/students");
    await snap(page, "mobile-admin-02-students");

    // Bottom tab bar reachability check — tap Batches
    const batchesTab = page.getByRole("link", { name: /batches/i }).first();
    if (await batchesTab.isVisible().catch(() => false)) {
      await batchesTab.click();
      await snap(page, "mobile-admin-03-batches");
    }
  });

  test("teacher on phone", async ({ page }) => {
    await login(page, teacherCreds(), "/teacher");
    await snap(page, "mobile-teacher-01-landing");

    const firstBatch = page.locator('a[href^="/teacher/batches/"]').first();
    if (await firstBatch.isVisible().catch(() => false)) {
      await firstBatch.click();
      await snap(page, "mobile-teacher-02-batch");

      const firstSession = page.locator('a[href^="/teacher/sessions/"]').first();
      if (await firstSession.isVisible().catch(() => false)) {
        await firstSession.click();
        await snap(page, "mobile-teacher-03-attendance");
      }
    }
  });
});
