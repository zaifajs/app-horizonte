# Phase 1: Foundation — ✅ complete

Last updated: 2026-05-12 (overnight session)

Everything in `tasks/plan.md` Phase 1 (1.1–1.9) is done and deployed to staging.

## What works right now

- **https://stage.nhorizonte.pt** — live, auto-deployed on every push to `develop`
- **https://stage.nhorizonte.pt/login** — English admin login
- **Dev admin credentials** (see `.env.local`, lines `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`)
- **Locale routing** — `/en`, `/pt`, `/bn`, `/ur` all serve the home page in the right language (Urdu auto-flips to RTL)
- **Admin gate** — unauthenticated `/admin/*` redirects to `/login`
- **DB** — 13 tables migrated in the `horizonte-dev` Supabase project; PLA course + 6 modules seeded

## Pipeline

```
push to develop  →  GitHub Actions CI (lint, typecheck, build)
                →  GitHub Actions Deploy (SSH root@VPS → run scripts/deploy-on-vps.sh)
                →  git fetch + reset, npm ci, prisma migrate deploy, npm run build
                →  pm2 reload horizonte-stage
                →  live on stage.nhorizonte.pt within ~1 min
```

`master` branch is wired the same way for production — but `app.nhorizonte.pt` is still serving a 502 because no commit has hit master yet. That's intentional. We'll cut to master at Task 7.5.

## What you should do when you wake up

1. **Try logging in** at https://stage.nhorizonte.pt/login with the credentials in `.env.local`. After sign-in you should land on `/admin/today` (still a placeholder).
2. **Rotate the dev admin password** — I generated it and echoed it to chat history. Replace via Supabase dashboard or `npm run db:seed:admin` after editing `SEED_ADMIN_PASSWORD` in `.env.local`.
3. **Enable master branch protection** on GitHub if you haven't already (Settings → Branches → require PR from develop + require CI pass). Pending from Task 1.2.
4. **Decide whether to invite the secretary now** to test the multi-user flow, or wait until later.

## What's next (Phase 2)

Per `tasks/plan.md`, Phase 2 is the batch lifecycle:
- 2.1 BatchSession generator (pure fn, holiday-aware)
- 2.2 Create-batch form
- 2.3 Cronograma journey view (6 module cards) + Today card + module drill-in
- 2.4 Schedule-table view + print export
- 2.5 Per-session reschedule

The 6 modules + PLA course are already seeded, so 2.1 can start immediately. Each task has acceptance criteria in `tasks/plan.md`.

## Pending small items

- **Master branch protection** on GitHub UI (Task 1.2 acceptance criterion)
- **Rotate dev admin password** (housekeeping; was in chat)
- **Pre-flight wa.me delivery test** (Task 0.1) — manual, you do this before Phase 5

## Tech notes worth remembering

- **Prisma 7** requires the pg driver adapter (`src/lib/db.ts`). Old `new PrismaClient()` doesn't work anymore.
- **Supabase no longer allows direct IPv4 connections** — both `DATABASE_URL` and `DIRECT_URL` use the pooler (transaction at 6543, session at 5432). Stored in `.env.local`.
- **Site PORTs** are sourced from each VPS `.env` file by the deploy script before `pm2 start`, so `next start` reads them via `process.env.PORT`.
- **i18n is public-only** — `/admin/*` stays in English, no locale prefix. Implemented by skipping the next-intl middleware for non-locale paths.
- **Branch policy:** all work happens on `develop` → push triggers stage deploy. `master` is reserved for cuts to production (Task 7.5).

## Repo state

```
Branch: develop
Latest commit: c595345 (chore: mark Phase 1 tasks complete in todo)
Working tree: clean
GitHub: zaifajs/app-horizonte (https://github.com/zaifajs/app-horizonte)
```
