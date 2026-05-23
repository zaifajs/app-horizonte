# Playwright e2e — UX tour scripts

These tests are not assertions; they're a **screenshot tour** that captures every major screen of the live app. The output (`e2e/screenshots/`) feeds the grounded UX review.

## One-time setup

1. Install browsers (one-shot):
   ```bash
   npx playwright install chromium
   ```

2. Add E2E credentials to `.env.local` (already gitignored):
   ```
   E2E_BASE_URL=https://stage.nhorizonte.pt
   E2E_ADMIN_EMAIL=...
   E2E_ADMIN_PASSWORD=...
   E2E_TEACHER_EMAIL=...
   E2E_TEACHER_PASSWORD=...
   ```
   Recommended: create dedicated `e2e-admin@…` and `e2e-teacher@…` users in Supabase so the tour doesn't muck with real accounts.

## Run

```bash
# Everything (admin + teacher + mobile)
npx playwright test

# Just one project
npx playwright test --project=admin
npx playwright test --project=teacher
npx playwright test --project=mobile

# Headed (watch it run in a real browser window)
npx playwright test --headed
```

Screenshots land in `e2e/screenshots/`. HTML report: `npx playwright show-report`.

## Adding new flows

- Tag tests with `@admin`, `@teacher`, or `@mobile` in the describe block so the project's `grep` matches.
- Use the `snap(page, name)` helper for consistent screenshot file paths.
- Keep tests assertion-free for now — flow + screenshot only. Add assertions later when we want real regression coverage.

## Why no assertions yet

The goal of this folder right now is **observability**, not regression testing. Once the design stabilizes we'll layer assertions on top (e.g., "Today dashboard shows N overdue", "selecting 2 rows opens composer").
