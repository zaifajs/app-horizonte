# Horizonte CRM v1 — Todo

Source of truth for what's left. Tick boxes as work completes. Full context in `tasks/plan.md`.

## Phase 0: Pre-flight
- [ ] 0.1 Validate wa.me delivery (send 20 manual reminders, measure send-through)
- [ ] 0.2 Confirm repo location + DNS access for nhorizonte.pt

## Phase 1: Foundation (local + deploy infra)
- [x] 1.1 Upgrade Node 16 → 22 (local) — already on v22.21.1
- [~] 1.2 Scaffold Next.js 16 + git + push to GitHub — master + develop pushed; **master protection pending** (UI or `gh auth login`)
- [ ] 1.3 shadcn/ui + base layout
- [x] 1.4 horizonte-dev + horizonte-prod Supabase projects created (eu-west-1); student-documents bucket created; .env.local wired; stage + prod .env files staged in /tmp
- [x] 1.5 CloudPanel: stage.nhorizonte.pt + app.nhorizonte.pt Node sites created with SSL + env files
- [x] 1.6 GitHub Actions: CI workflow + deploy workflow (SSH to VPS on push to develop/master)
- [x] 1.7 Prisma schema (13 tables) + initial migration applied to dev DB
- [x] 1.8 Seed: PLA + 6 modules on dev DB + dev admin user (huzaifa.wp@gmail.com)
- [x] 1.9 Auth + role-based route guards (Supabase Auth + middleware)
- [x] **Checkpoint: Foundation complete — push to develop deploys to stage.nhorizonte.pt with working login**

## Phase 2: Batch lifecycle
- [x] 2.1 BatchSession generator (pure fn + 9 unit tests, holiday-aware; PT calendar by default, injectable for tests)
- [x] 2.2 Create-batch form (admin + staff) — /admin/batches list + /admin/batches/new form; creates Batch + 36 BatchSessions + audit log
- [x] 2.3a Cronograma journey grid (6 module cards w/ status, dates, hours)
- [x] 2.3b Today card (floating dark card when a session is today)
- [x] 2.3c Module drill-in (per-module session table below cards)
- [x] 2.4 Schedule-table view (?view=table) + print export (?print=1)
- [x] 2.5 Per-session reschedule (Edit dialog, audit-logged, cancel requires note)
- [ ] **Checkpoint: Batch lifecycle — human review**

## Phase 3: Student lifecycle
- [x] 3.1 Document upload helper (Supabase Storage, signed URLs)
- [x] 3.2a Public registration form UI + Zod validation (bilingual, all 4 locales)
- [x] 3.2b Public registration server action — creates Student + Enrollment (PENDING). No prefilled Payments — staff records them ad-hoc.
- [x] 3.3 Staff "Add student" page
- [x] 3.4a Student detail page layout (info, docs, enrollments, payments, notes)
- [x] 3.4b logChange() helper wired into every mutation
- [x] 3.4c Audit log activity stream UI
- [x] **Bonus:** PENDING enrollment status + auto-activate on first payment
- [x] **Bonus:** Simplified payment model (no fixed installments; partial payments via N Payment rows under one Enrollment; Course.feeCents = total target)
- [x] **Bonus:** Paid/Due columns in students list
- [x] **Checkpoint: Student lifecycle — human review**

## Phase 4: Master table + payment flow
- [ ] 4.1 Master student table (TanStack, sortable, paginated server-side)
- [ ] 4.2a Filter UI (batch, trainer, payment status, installments, method, dates, etc.)
- [ ] 4.2b Server-side query builder
- [ ] 4.2c Saved views (URL-stateful)
- [ ] 4.3 Mark-paid dialog (inline + detail, with proof upload)
- [ ] 4.4 CSV export of filtered view
- [ ] **Checkpoint: Master table + payments — human review**

## Phase 5: Communication
- [ ] 5.1 MessagingProvider interface + wa.me impl + 3 hardcoded templates
- [ ] 5.2 Bulk WhatsApp send (click-through queue with MessageLog)
- [ ] 5.3 Resend setup + DNS + email send adapter + 3 email templates
- [ ] 5.4 Bulk email send (rate-limited)
- [ ] **Checkpoint: Communication — human review**

## Phase 6: Teacher view + attendance
- [ ] 6.1 Teacher landing + own batches list (read-only)
- [ ] 6.2 Session detail + 5-state attendance (Present/Late/Left early/Excused/Unexcused) + notes
- [ ] **Checkpoint: Teacher view — human review**

## Phase 7: Polish + launch
- [ ] 7.1 Admin Users page (invite + deactivate)
- [ ] 7.2 "Today" screen (overdue + due this week + new registrations)
- [ ] 7.3 iCal feed per batch
- [ ] 7.4 Portuguese copy pass + confirmation dialogs everywhere
- [ ] 7.5 Production go-live (clean prod DB, invite admins, smoke test, cutover date)
- [ ] **Checkpoint: Complete — sheet retirement date agreed**
