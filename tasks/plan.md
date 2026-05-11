# Implementation Plan: Horizonte CRM v1

## Overview

Greenfield Next.js 15 + Supabase + Prisma school-management app for Novo Horizonte. Spec: `docs/ideas/horizonte-crm-v1.md`. The product replaces a Google Form + Sheet workflow. The headline win is killing the payment-chase loop via a master student table with filters and one-click WhatsApp/email reminders. Cronograma is reframed as a 6-module journey + Today card. Admin + staff (secretary) + teacher roles in v1; student accounts are created dormant for v2 portal.

## Architecture Decisions

- **Stack:** Next.js 15 App Router + TypeScript + Tailwind + shadcn/ui + Prisma + Supabase (Postgres/Auth/Storage) + Resend + TanStack Table. Validation via Zod + react-hook-form. PT-primary copy.
- **Two Supabase projects** — `horizonte-dev` (used by staging) and `horizonte-prod` (used by production). Free tier.
- **Repo location:** `/Users/huzaifa/Sites/app-horizonte` (the current working directory; already contains `PLAN.md`, `docs/`, `tasks/`). GitHub remote: `https://github.com/zaifajs/app-horizonte` (already created).
- **Self-hosted on Hostinger VPS via CloudPanel** (already running `nyro`; `nhorizonte.pt` DNS already points to VPS). Two CloudPanel Node.js sites: `stage.nhorizonte.pt` and `app.nhorizonte.pt`. nginx + Let's Encrypt SSL + PM2 auto-managed by CloudPanel.
- **Branch strategy:** `master` → prod, `develop` → staging. Feature branches → PR into `develop`.
- **CI/CD:** GitHub Actions runs lint/typecheck/test/build on every PR. On push to `develop` or `master`, Actions SSHes into the VPS, pulls, runs `prisma migrate deploy`, builds, reloads PM2.
- **Money as integer cents + `currency` field on `Payment`** — forward-compat with future bookkeeping module.
- **Audit log via explicit `logChange()` calls** in each server action — not silent Prisma middleware.
- **Cronograma generator skips Sat/Sun + Portuguese national holidays** (`date-holidays` npm).
- **wa.me only in v1** behind a `MessagingProvider` interface so Cloud API is a v2 swap.
- **`MessageTemplate` hardcoded as constants** in v1 (3 templates: welcome, payment-1 reminder, payment-2 reminder). Editor UI is v1.1+.
- **Pre-flight check before code begins:** send 20 wa.me reminders manually, measure send-through rate. If <90%, rethink WhatsApp strategy.

## Dependency Graph

```
Node 22 (local) + GitHub repo + Supabase dev/prod + CloudPanel sites
         │
         ├── GitHub Actions CI/CD (pushes to develop → staging, master → prod)
         │        │
         │        └── Prisma schema + migrations (auto-apply on deploy)
         │                 │
         │                 ├── Auth + role guards
         │                 │        │
         │                 │        ├── Batch lifecycle (Phase 2)
         │                 │        │        └── Cronograma journey view
         │                 │        │
         │                 │        ├── Student lifecycle (Phase 3)
         │                 │        │        ├── Public registration form
         │                 │        │        ├── Student detail page + audit log
         │                 │        │        └── Document upload (Supabase Storage)
         │                 │        │
         │                 │        ├── Master table + payment flow (Phase 4)
         │                 │        │
         │                 │        ├── Messaging (Phase 5: wa.me + Resend)
         │                 │        │
         │                 │        ├── Teacher view + attendance (Phase 6)
         │                 │        │
         │                 │        └── Polish (Phase 7)
         │                 │
         │                 └── PLA + Module seed
         │
         └── Resend account + DNS records on nhorizonte.pt
```

---

## Phase 0: Pre-flight (no code)

### Task 0.1: Validate wa.me delivery
**Description:** Before any code is written, send 20 wa.me reminders manually from staff phones, log delivery success. If <90% read-rate or admins say "it's awkward to click 20 tabs," revisit WhatsApp strategy (consider Cloud API earlier than planned).

**Acceptance criteria:**
- [ ] 20 messages sent across at least 3 different admin sessions
- [ ] Send-through rate ≥ 90%
- [ ] Decision recorded in `docs/ideas/horizonte-crm-v1.md` under assumptions

**Verification:** Manual. Doc updated.
**Dependencies:** None
**Estimated scope:** XS (no code)

### Task 0.2: Resolve repo location + confirm DNS access
**Description:** Confirm repo will live at `/Users/huzaifa/Sites/app-horizonte` (or chosen alt). Confirm user has DNS access for `nhorizonte.pt` to add Resend SPF/DKIM records.

**Acceptance criteria:**
- [ ] Repo path confirmed with user
- [ ] DNS access for `nhorizonte.pt` confirmed

**Verification:** Documented in this plan
**Dependencies:** None
**Estimated scope:** XS

---

## Phase 1: Foundation (local + deploy infra)

**Goal:** by end of Phase 1, pushing to `develop` automatically deploys the app to `stage.nhorizonte.pt` with a working login.

### Task 1.1: Upgrade Node 16 → 22 (local)
**Description:** Local dev environment needs Node ≥18.18. Recommended Node 22.

**Acceptance criteria:**
- [ ] `node -v` reports v22.x
- [ ] `npm -v` works

**Verification:** `node -v && npm -v`
**Dependencies:** None
**Estimated scope:** XS

### Task 1.2: Scaffold Next.js 15 + wire git remote
**Description:** At `/Users/huzaifa/Sites/app-horizonte` (already has `PLAN.md`, `docs/`, `tasks/` — preserve them).
1. `git init`, add remote `https://github.com/zaifajs/app-horizonte`
2. Scaffold via `npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir --import-alias "@/*"` (use `.` so it runs in the existing dir; merge with existing files)
3. Install core deps: `prisma`, `@prisma/client`, `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `react-hook-form`, `@hookform/resolvers`, `lucide-react`, `@tanstack/react-table`, `date-fns`, `date-holidays`
4. Push initial commit to `master`; create `develop` branch; push.
5. Protect `master` on GitHub: require PR from `develop`, require CI checks.

**Acceptance criteria:**
- [ ] `git remote -v` shows `https://github.com/zaifajs/app-horizonte`
- [ ] Both `master` and `develop` exist on origin
- [ ] `PLAN.md`, `docs/`, `tasks/` preserved in the repo
- [ ] `npm run dev` starts on `localhost:3000`
- [ ] `npm run build` succeeds
- [ ] TypeScript strict mode enabled
- [ ] `master` branch protection rule active

**Verification:** `npm run dev` + visit homepage; GitHub UI shows both branches and the existing planning files.
**Dependencies:** 1.1
**Estimated scope:** S

### Task 1.3: shadcn/ui + base layout
**Description:** Init shadcn/ui. Install components: button, input, table, form, dialog, select, toast, dropdown-menu, badge, tabs, separator, label, textarea. Build minimal app shell: `/(public)` and `/(admin)` route groups with a placeholder header.

**Acceptance criteria:**
- [ ] shadcn/ui installed and a sample Button renders on the homepage
- [ ] Public layout and admin layout coexist
- [ ] Tailwind config loads PT-locale-safe fonts (Inter or similar)

**Verification:** Visit `/` and `/admin` placeholder pages.
**Dependencies:** 1.2
**Estimated scope:** S

### Task 1.4: Create both Supabase projects + capture all keys
**Description:** Create `horizonte-dev` and `horizonte-prod` projects (eu-west-1). For each, capture: DATABASE_URL (pooler), DIRECT_URL (direct), NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Create `student-documents` private Storage bucket in both. Add `.env.local` (dev keys) for local dev. Commit `.env.example` with key names only.

**Acceptance criteria:**
- [ ] Both Supabase projects exist
- [ ] `student-documents` private bucket in both projects
- [ ] `.env.local` populated with dev keys, `.env.local` in `.gitignore`
- [ ] All prod keys stored in a password manager (not on disk)

**Verification:** Smoke test Supabase query from a local route.
**Dependencies:** 1.2
**Estimated scope:** S

### Task 1.5: CloudPanel — create staging + prod Node sites
**Description:** In CloudPanel: create two Node.js sites — `stage.nhorizonte.pt` and `app.nhorizonte.pt` (neither currently serves anything — safe to bind). Each gets its own Linux user, home directory, port. Issue Let's Encrypt SSL for both. Set Node version to 22. Place each site's `.env` file with the correct Supabase keys (dev for staging, prod for app). Verify both serve a 502 (no app running yet) over HTTPS.

**Acceptance criteria:**
- [ ] `https://stage.nhorizonte.pt` resolves with valid SSL
- [ ] `https://app.nhorizonte.pt` resolves with valid SSL
- [ ] `.env` file present in each site directory with correct keys
- [ ] SSH access works for both site users

**Verification:** `curl -I https://stage.nhorizonte.pt` returns 502 with valid TLS.
**Dependencies:** 1.4
**Estimated scope:** M

### Task 1.6: GitHub Actions — CI + deploy workflows
**Description:** Two workflow files.
- `.github/workflows/ci.yml`: on PR to `develop` or `master`, run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- `.github/workflows/deploy.yml`: on push to `develop` SSH as staging user; on push to `master` SSH as prod user. Steps: `cd ~/htdocs/<domain> && git pull && npm ci && npx prisma migrate deploy && npm run build && pm2 reload <app-name>`.

Add `package.json` script: `"build": "prisma generate && next build"`. Add `npm run db:migrate:deploy` shortcut.

Store secrets in GitHub: `VPS_HOST=72.62.38.204`, `VPS_SSH_KEY` (contents of `~/.ssh/id_ed25519_hostinger`). Deploy paths and PM2 app names are hardcoded in the workflow (not secret):

| Env | Path | PM2 app name | Port |
|---|---|---|---|
| stage | `/home/nhorizonte-stage/htdocs/stage.nhorizonte.pt` | `horizonte-stage` | 3010 |
| prod  | `/home/nhorizonte-app/htdocs/app.nhorizonte.pt` | `horizonte-prod` | 3011 |

**SSH user:** deploy as `root` using the existing `~/.ssh/id_ed25519_hostinger` key (Option A, confirmed).

**Security — never commit the SSH key:**
- Private key lives only on the local Mac (`~/.ssh/id_ed25519_hostinger`) and in GitHub Secrets (`VPS_SSH_KEY`)
- `.gitignore` must include: `**/id_*`, `**/*.pem`, `**/*.key`, `.env*` (except `.env.example`)
- CI workflow files reference the secret by name (`${{ secrets.VPS_SSH_KEY }}`) — never inline
- Add a pre-commit hook (`detect-secrets` or `git-secrets`) before Phase 2 to fail commits containing key-looking strings

**Acceptance criteria:**
- [ ] CI workflow runs on PRs and blocks merge on failure
- [ ] Push to `develop` deploys to staging successfully
- [ ] Push to `master` deploys to prod successfully
- [ ] Migrations apply before build runs on each deploy
- [ ] PM2 logs show app running after each deploy

**Verification:** Push a "hello world" commit to `develop`, see it live at `stage.nhorizonte.pt`.
**Dependencies:** 1.5
**Estimated scope:** M

### Task 1.7: Prisma schema (full v1 data model) + initial migration
**Description:** Write `prisma/schema.prisma` for: `User` (admin/staff/teacher/student), `Course`, `Module`, `Batch`, `BatchSession` (classroom/autonomous, status enum), `Student`, `Enrollment`, `Payment` (cents int + currency + method enum + proof_url + status), `Document` (front/back, expiry), `Note`, `MessageLog`, `AuditLog`, `Attendance` (5-state enum). Run `prisma migrate dev --name init` locally. Commit migration. Push to `develop` → migration auto-applies to dev DB on deploy. Merge to `master` → migration auto-applies to prod DB.

**Acceptance criteria:**
- [ ] All v1 tables present in dev DB and prod DB
- [ ] Money columns are `Int` (cents); `currency` column defaults to `EUR`
- [ ] Enums for role, payment_method, payment_status, session_kind, session_status, attendance_state
- [ ] `AuditLog.student_id` indexed; `Payment.due_date`, `Payment.paid_at` indexed

**Verification:** Prisma Studio against both DBs; tables visible.
**Dependencies:** 1.6
**Estimated scope:** M

### Task 1.8: Seed script — PLA course + 6 modules + dev admin
**Description:** `prisma/seed.ts` upserts 1 `Course` (PLA, level "A1+A2", 150h), 6 `Module` rows. Optional `--with-dev-admin` flag creates a known admin user for dev only. Wire `npm run db:seed`. Run on dev DB; do **not** run dev-admin step on prod.

**Acceptance criteria:**
- [ ] Idempotent (upserts on stable keys)
- [ ] Dev admin created on staging DB only, not prod
- [ ] Modules numbered 1–6 in correct order in both DBs

**Verification:** Prisma Studio on both DBs.
**Dependencies:** 1.7
**Estimated scope:** S

### Task 1.9: Auth + role-based route guards
**Description:** Supabase Auth via `@supabase/ssr`. Login page at `/login`. Middleware redirects unauthenticated users to `/login` for `/admin/*` and `/teacher/*` routes. After login, redirect by role: admin/staff → `/admin/today`, teacher → `/teacher`, student → 403 (account dormant). `lib/auth.ts` exports `getCurrentUser()`, `requireRole(...)`.

**Acceptance criteria:**
- [ ] Login works for the seeded dev admin on staging
- [ ] Unauthenticated visitor to `/admin/*` redirects to `/login`
- [ ] A user with role=student visiting `/admin` gets a 403 page in PT
- [ ] Logout clears the session and redirects to `/login`

**Verification:** Manual test on `stage.nhorizonte.pt`.
**Dependencies:** 1.8
**Estimated scope:** M

### Checkpoint: Foundation
- [ ] Push to `develop` deploys to `stage.nhorizonte.pt` with migrations applied
- [ ] Login works end-to-end on staging
- [ ] CI blocks merges on lint/type/test/build failure
- [ ] Master branch protected, requires PR from develop
- [ ] **Human review before Phase 2**

---

## Phase 2: Batch lifecycle (cronograma)

### Task 2.1: `BatchSession` generator (pure function + unit tests)
**Description:** `lib/cronograma/generate.ts` — pure function `generateSessions({ startDate, startTime, durationHours, weekdays })` returns 36 session specs (30 classroom + 6 autonomous). Walks weekdays, skips Sat/Sun and Portuguese national holidays (`date-holidays` PT). Inserts an autonomous-work row at the end of each module's 5 classroom days.

**Acceptance criteria:**
- [ ] Output is deterministic for a given input
- [ ] National holidays in 2026 are skipped (test: a batch starting near 25 December rolls past it)
- [ ] Unit tests cover: weekend skipping, holiday skipping, module boundaries, autonomous-row placement

**Verification:** `npm test -- generate`
**Dependencies:** 1.5
**Estimated scope:** M

### Task 2.2: Create-batch form (admin + staff)
**Description:** `/admin/batches/new` form. Fields: course (PLA dropdown), code (unique, free text), start_date, start_time (default 14:00), duration_hours (default 4), trainer (dropdown of teacher users), capacity (default 25). On submit: create `Batch` + 36 `BatchSession` rows in one transaction via the generator. Audit-log the create.

**Acceptance criteria:**
- [ ] Zod validation, PT-primary copy with EN helper text
- [ ] Unique-code violation shown as a friendly error, not a stack trace
- [ ] 36 sessions visible in Prisma Studio after a successful create
- [ ] AuditLog row written

**Verification:** Create a batch, inspect DB.
**Dependencies:** 1.7, 2.1
**Estimated scope:** M

### Task 2.3: Cronograma journey view + Today card
**Description:** `/admin/batches/[id]` shows: 6 module cards (status, dates spanned, hours logged vs planned), floating Today card if a session is today, click a module → drawer/section with that module's 5 sessions + roster + attendance heatmap placeholder. Session status (Scheduled/Held/Cancelled/Rescheduled) renders with colored icons.

**Acceptance criteria:**
- [ ] Module cards render in correct order with correct date spans
- [ ] Today card appears when current date matches a session
- [ ] Mobile-first responsive layout (single column on phone)
- [ ] PT copy throughout

**Verification:** Manual on multiple viewport sizes.
**Dependencies:** 2.2
**Estimated scope:** L → break: 2.3a journey grid, 2.3b Today card, 2.3c module drill-in

### Task 2.4: Schedule-table view + print export
**Description:** Toggle on batch page → renders the classic Formadores · Módulos · Datas · H. Início table. `?print=1` URL strips chrome for browser print/PDF.

**Acceptance criteria:**
- [ ] Table matches the existing PDF visually closely enough to use at enrolment
- [ ] Print stylesheet hides nav/footer
- [ ] Generates correctly via browser "Save as PDF"

**Verification:** Manual print preview.
**Dependencies:** 2.3
**Estimated scope:** S

### Task 2.5: Per-session reschedule (single date edit)
**Description:** Click a session → dialog with status (Scheduled/Held/Cancelled), date, time, trainer-override. Save updates `BatchSession`. Audit-log the change. Cascade-shift NOT in scope (deferred).

**Acceptance criteria:**
- [ ] Date edit persists
- [ ] Status change persists with optional reason note (required for Cancelled)
- [ ] AuditLog row written
- [ ] No accidental cascade — only the chosen row changes

**Verification:** Edit a session, refresh, confirm.
**Dependencies:** 2.3
**Estimated scope:** S

### Checkpoint: Batch lifecycle
- [ ] An admin can create a batch and see its cronograma in the journey view
- [ ] An admin can reschedule a single session and the change is audit-logged
- [ ] Schedule-table view prints cleanly
- [ ] **Human review before Phase 3**

---

## Phase 3: Student lifecycle

### Task 3.1: Document upload helper (Supabase Storage)
**Description:** `lib/storage.ts` — upload file to `student-documents` private bucket, return signed URL helper. Used by registration form and admin student-edit.

**Acceptance criteria:**
- [ ] Files upload to a private bucket
- [ ] Filenames are namespaced by student id (e.g. `students/<id>/passport-front.pdf`)
- [ ] Signed-URL helper returns a 1-hour URL for staff to view

**Verification:** Upload via a test page, confirm visible only via signed URL.
**Dependencies:** 1.4
**Estimated scope:** S

### Task 3.2: Public registration form
**Description:** `/(public)/register` — full bilingual form per spec (PT primary, EN helper). On submit: create `Student` row + dormant `User` (role=student) + `Enrollment` for chosen batch + 2 `Payment` rows (€225 each, due dates derived from batch start + week-4). GDPR consent timestamped. No payment collected in form.

**Acceptance criteria:**
- [ ] All required fields validated (Zod)
- [ ] Doc upload front + back works
- [ ] Submission idempotent on duplicate email (returns "already registered" not a 500)
- [ ] Batch dropdown shows only `upcoming` and `active` batches
- [ ] AuditLog row written (actor = "public")

**Verification:** Fill form end-to-end with a real PDF upload.
**Dependencies:** 2.2, 3.1
**Estimated scope:** L → break: 3.2a form UI + validation, 3.2b server action (create + payments)

### Task 3.3: Staff "Add student" page
**Description:** `/admin/students/new` — same shape as the public form, scoped to admin/staff. Auto-fills `created_by` to the current user.

**Acceptance criteria:**
- [ ] Reuses the same Zod schema as 3.2
- [ ] Staff can add a student without going through the public flow
- [ ] AuditLog records the staff user as actor

**Verification:** Create a student as the secretary.
**Dependencies:** 3.2
**Estimated scope:** S

### Task 3.4: Student detail page + audit log activity stream
**Description:** `/admin/students/[id]` — personal info (editable), documents (with signed-URL view), enrollments across batches, full payment history (editable), message log, free-text notes, **audit log** reverse-chronological activity stream. Implement `logChange()` helper used by all mutations.

**Acceptance criteria:**
- [ ] All sections render
- [ ] Editing any field writes an AuditLog row with diff
- [ ] AuditLog is immutable (no UI to edit/delete; DB has no `updated_at`)
- [ ] PT-primary copy

**Verification:** Edit a field, confirm log shows the change.
**Dependencies:** 3.3
**Estimated scope:** L → break: 3.4a layout + sections, 3.4b `logChange()` helper + wire into existing mutations, 3.4c activity stream UI

### Checkpoint: Student lifecycle
- [ ] Public registration creates a student + enrollment + 2 payments
- [ ] Staff can add a student manually
- [ ] Student detail page shows everything and audit-logs edits
- [ ] **Human review before Phase 4**

---

## Phase 4: Master table + payment flow (headline)

### Task 4.1: Master student table (read-only first)
**Description:** `/admin/students` — TanStack Table with columns: Name, Phone, Batch, Trainer, Inst 1 status, Inst 2 status, Amount due, Last contacted, Notes. Sortable, paginated (server-side).

**Acceptance criteria:**
- [ ] Loads 100+ rows performantly
- [ ] Sorting works
- [ ] Click row → student detail page

**Verification:** Seed 50 students; navigate.
**Dependencies:** 3.4
**Estimated scope:** M

### Task 4.2: Master table filters + saved views
**Description:** Filters: batch, trainer, payment status, installment 1/2, payment method, days overdue, payment date range, nationality, registered date range. Saved views: "Overdue >7 days", "This batch's roster", "Installment 2 owing", "Paid this month".

**Acceptance criteria:**
- [ ] All filters work and compose (AND semantics)
- [ ] Saved views are bookmarkable URLs (state in query string)
- [ ] No client-side filter on large datasets — server filters

**Verification:** Apply each saved view, confirm result count matches a manual DB query.
**Dependencies:** 4.1
**Estimated scope:** L → break: 4.2a filter UI, 4.2b server-side query builder, 4.2c saved views

### Task 4.3: Mark-paid dialog (inline + on detail page)
**Description:** Dialog with method (bank/cash), amount (default installment amount in cents), date, collected-by (auto-current-user), proof PDF upload (required if bank). On save: update `Payment`, write AuditLog, save proof to Storage.

**Acceptance criteria:**
- [ ] Inline from master table row (works for both installments)
- [ ] Same dialog also reachable from student detail page
- [ ] Proof required when method=bank
- [ ] Partial payments supported (amount < installment full)
- [ ] AuditLog records the full diff

**Verification:** Mark a real payment with a PDF upload.
**Dependencies:** 3.1, 4.1
**Estimated scope:** M

### Task 4.4: CSV export of current filtered view
**Description:** Bulk action: "Export CSV" exports the current filtered rows. Server-side stream.

**Acceptance criteria:**
- [ ] Exported CSV opens cleanly in Excel/Numbers with PT chars intact (UTF-8 BOM)
- [ ] Respects the active filters
- [ ] Includes payment history fields

**Verification:** Export, open, eyeball.
**Dependencies:** 4.2
**Estimated scope:** S

### Checkpoint: Master table + payment flow
- [ ] Staff can find any subset of students via filters
- [ ] Staff can mark-paid inline with proof upload
- [ ] CSV export works
- [ ] **Human review before Phase 5**

---

## Phase 5: Communication

### Task 5.1: `MessagingProvider` interface + wa.me implementation
**Description:** `lib/messaging/index.ts` exports `sendMessage(to, body)`. v1 impl returns `{ via: 'wa.me', url }`. Hardcoded 3 templates with `{{name}}`, `{{amount}}`, `{{batch}}` interpolation.

**Acceptance criteria:**
- [ ] `sendMessage()` returns a correctly URL-encoded `wa.me` link
- [ ] Phone numbers normalize to E.164 (PT default +351)
- [ ] Template interpolation unit-tested

**Verification:** Click a sample link, see WhatsApp Web open with the message.
**Dependencies:** 1.5
**Estimated scope:** S

### Task 5.2: Bulk WhatsApp send (click-through queue)
**Description:** Select N rows in master table → "Send WhatsApp" → queue UI showing "3 of 30 sent." Each click opens one `wa.me` link in a new tab and writes a `MessageLog` row. No fake "Send all" button.

**Acceptance criteria:**
- [ ] Queue UI is honest about being one-tab-at-a-time
- [ ] Each click logs to `MessageLog` with template used, body, actor, recipient
- [ ] Skip/Cancel options on the queue

**Verification:** Run on 5 test students, confirm 5 MessageLog rows.
**Dependencies:** 4.2, 5.1
**Estimated scope:** M

### Task 5.3: Resend setup + email send adapter
**Description:** Create Resend account, add SPF/DKIM/DMARC records to `nhorizonte.pt`, store API key in env. `lib/messaging/email.ts` sends transactional email from `noreply@nhorizonte.pt`. Hardcoded 3 email templates parallel to WhatsApp ones.

**Acceptance criteria:**
- [ ] DNS verifies in Resend
- [ ] A test email sends successfully and lands in inbox (not spam)
- [ ] Bounce webhook handler logs failed sends

**Verification:** Send a test from a dev script.
**Dependencies:** 0.2, 1.4
**Estimated scope:** M

### Task 5.4: Bulk email send
**Description:** Same selection model as 5.2 but server-side fan-out via Resend. MessageLog rows include `sent_via='email'`.

**Acceptance criteria:**
- [ ] Sends to N selected rows
- [ ] Failures recorded in MessageLog with error
- [ ] Rate-limited to respect Resend 100/day free-tier ceiling (queue + delay if needed)

**Verification:** Send to 3 test inboxes, check delivery + MessageLog.
**Dependencies:** 4.2, 5.3
**Estimated scope:** M

### Checkpoint: Communication
- [ ] Staff can send WhatsApp + email to filtered groups
- [ ] All sends audit-logged
- [ ] **Human review before Phase 6**

---

## Phase 6: Teacher view + attendance

### Task 6.1: Teacher login landing + own batches list
**Description:** `/teacher` — logged-in teacher sees the batch(es) they're trainer for. No payment data. Read-only.

**Acceptance criteria:**
- [ ] Teacher sees only their own batches
- [ ] Cannot access `/admin/*` routes
- [ ] PT copy

**Verification:** Create a teacher user, assign to a batch, log in.
**Dependencies:** 1.7, 2.2
**Estimated scope:** S

### Task 6.2: Teacher session detail + attendance check
**Description:** Click a session → today's roster with 5-state attendance picker (Present / Late / Left early / Excused / Unexcused) + free-text notes per session. Save creates `Attendance` rows.

**Acceptance criteria:**
- [ ] 5-state enum stored correctly
- [ ] Per-session notes saved
- [ ] Idempotent re-save (updates existing rows, not duplicates)
- [ ] AuditLog records "session held" + attendance summary

**Verification:** Mark attendance for a test session, refresh, edit, save again.
**Dependencies:** 6.1
**Estimated scope:** M

### Checkpoint: Teacher view
- [ ] Teacher can log in, see their batch, mark attendance
- [ ] **Human review before Phase 7**

---

## Phase 7: Polish + launch readiness

### Task 7.1: Admin Users page (invite + deactivate)
**Description:** `/admin/users` — list of all users, invite via Supabase Auth invite-by-email, role select, deactivate (soft) toggle. Admin-only route.

**Acceptance criteria:**
- [ ] Invite email arrives with set-password link
- [ ] Role can be admin/staff/teacher
- [ ] Deactivate flips a flag; user can no longer log in but row preserved

**Verification:** Invite a real test email; complete the flow.
**Dependencies:** 1.7
**Estimated scope:** M

### Task 7.2: "Today" screen
**Description:** `/admin/today` — admin/staff landing page. Three sections: overdue installments (with inline mark-paid + wa.me), payments due this week, new registrations to confirm.

**Acceptance criteria:**
- [ ] Loads in <1s with 100 students
- [ ] Each row clickable to student detail
- [ ] Inline actions work (mark-paid, wa.me)

**Verification:** Manual.
**Dependencies:** 4.3, 5.1
**Estimated scope:** M

### Task 7.3: iCal feed per batch
**Description:** `GET /api/batches/[id]/calendar.ics` returns a valid `.ics` feed of that batch's classroom sessions. Token-protected URL (not public). Updates when sessions are rescheduled.

**Acceptance criteria:**
- [ ] Feed validates in `icalendar.org` validator
- [ ] Subscribing in Google Calendar shows the sessions correctly
- [ ] Rescheduled sessions update on next fetch

**Verification:** Subscribe in Google Calendar.
**Dependencies:** 2.5
**Estimated scope:** S

### Task 7.4: Portuguese copy pass + confirmation dialogs
**Description:** Audit every user-facing string. Replace any English/lorem with PT. Add confirmation dialogs on every destructive action ("Eliminar estudante?" / "Cancelar sessão?"). Validation messages translated.

**Acceptance criteria:**
- [ ] No English strings remain on user-facing pages (run `grep -RIn "[A-Z][a-z]\+" src/app | review`)
- [ ] All deletes/cancels show a confirm dialog
- [ ] Zod errors render in PT

**Verification:** Walk through every admin page as the secretary persona.
**Dependencies:** all earlier phases
**Estimated scope:** M

### Task 7.5: Production go-live
**Description:** Prod URL has been live since Phase 1 (Task 1.5) but with no real data. Go-live = first real cutover. Steps: confirm prod DB has only PLA seed + no leftover test rows, invite the real admin (you) on prod, invite the secretary, smoke-test create-a-batch + register-a-student end-to-end on prod, agree a cutover date with the school, retire the Google Sheet.

**Acceptance criteria:**
- [ ] Prod DB clean (only PLA Course + 6 Modules seeded, no test students/batches)
- [ ] You + secretary can log in on `app.nhorizonte.pt`
- [ ] A throwaway end-to-end run on prod (register → payment → wa.me → delete) works
- [ ] Sheet retirement date written down somewhere

**Verification:** End-to-end smoke on prod with a throwaway batch, then drop it.
**Dependencies:** all earlier phases
**Estimated scope:** S

### Checkpoint: Complete
- [ ] All acceptance criteria met
- [ ] Sheet retirement date agreed
- [ ] Ready for first real batch on the new system

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| wa.me delivery is unreliable in practice | High | Phase 0 pre-flight test; if <90%, pull Cloud API forward |
| Secretary doesn't adopt the app (sticks with Sheet) | High | Cheat-sheet + Loom + agreed Sheet-retirement date (Task 7.5, 7.6) |
| DNS for `nhorizonte.pt` not accessible to dev | Medium | Confirm in Task 0.2 before relying on Resend |
| Schema choices block future bookkeeping module | Medium | Cents-as-int, currency field, keep `Payment` student-shaped (decided) |
| Audit log gets bypassed by a missed `logChange()` call | Medium | Code review checklist; consider Prisma extension that logs warnings on raw mutations (v1.1) |
| Resend free-tier limit hit during bulk send | Low | Rate-limit in Task 5.4; upgrade to paid if/when it actually matters |

## Open Questions

- ~~DNS access for `nhorizonte.pt`?~~ **Resolved:** yes.
- ~~Repo location?~~ **Resolved:** `/Users/huzaifa/Sites/app-horizonte`.
- ~~Public registration URL?~~ **Resolved:** `/register`.
- ~~Loom a launch blocker?~~ **Resolved:** yes — secretary onboarding Loom + cheat-sheet must ship at launch (Task 7.5 is a hard prerequisite for Task 7.6 prod deploy).
