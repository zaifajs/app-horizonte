import { test } from "@playwright/test";
import { ensureLoggedIn, snap } from "./helpers";

// Walks the admin through every major screen and screenshots each, so the
// resulting e2e/screenshots/ folder is a flip-book of the live UX. No
// assertions — this exists to feed the follow-up UX review.

test.describe("Admin tour @admin", () => {
  test("desktop walkthrough", async ({ page }) => {
    await ensureLoggedIn(page, "admin", "/admin/today");
    await snap(page, "admin-01-today");

    await page.goto("/admin/students");
    await snap(page, "admin-02-students-list");

    // Open the New student drawer (don't submit — just snapshot).
    await page.getByRole("button", { name: /new student/i }).first().click();
    await page.waitForTimeout(400);
    await snap(page, "admin-03-students-new-drawer");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    // Tick a couple of rows so the selection ribbon + bulk composer trigger
    const rowCheckboxes = page.locator('input[type="checkbox"].hz-cb').filter({
      hasNot: page.locator(":scope.indeterminate"),
    });
    const count = await rowCheckboxes.count();
    if (count > 1) {
      // Skip index 0 (select-all header)
      await rowCheckboxes.nth(1).check().catch(() => {});
      await rowCheckboxes.nth(2).check().catch(() => {});
    }
    await page.waitForTimeout(200);
    await snap(page, "admin-04-students-selection-ribbon");

    // Open the message composer
    await page.getByRole("button", { name: /send whatsapp/i }).first().click().catch(() => {});
    await page.waitForTimeout(500);
    await snap(page, "admin-05-message-composer");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    // Drill into the first student row → drawer
    const firstStudentLink = page.locator("table.stbl tbody tr").first();
    await firstStudentLink.click().catch(() => {});
    await page.waitForTimeout(700);
    await snap(page, "admin-06-student-drawer");

    // Follow into the full student detail
    const fullDetailsLink = page.getByRole("link", { name: /view full details/i }).first();
    if (await fullDetailsLink.isVisible().catch(() => false)) {
      await fullDetailsLink.click();
      await snap(page, "admin-07-student-detail");
    }

    await page.goto("/admin/batches");
    await snap(page, "admin-08-batches-list");

    const firstBatchLink = page.locator('a[href^="/admin/batches/"]').first();
    if (await firstBatchLink.isVisible().catch(() => false)) {
      await firstBatchLink.click();
      await page.waitForLoadState("networkidle").catch(() => {});
      await snap(page, "admin-09-batch-detail");

      // Attendance matrix
      const attendanceLink = page.getByRole("link", { name: /attendance/i }).first();
      if (await attendanceLink.isVisible().catch(() => false)) {
        await attendanceLink.click();
        await snap(page, "admin-10-batch-attendance");
      }
    }

    await page.goto("/admin/batches/new");
    await snap(page, "admin-11-batches-new");

    await page.goto("/admin/messages/templates");
    await snap(page, "admin-12-templates");

    await page.goto("/admin/users");
    await snap(page, "admin-13-users");
  });
});
