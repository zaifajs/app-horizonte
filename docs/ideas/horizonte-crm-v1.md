# Horizonte CRM — v1

## Problem Statement

**How might we** replace Novo Horizonte's Google Form + Sheet workflow with a system that cuts admin time per batch in half — primarily by killing the manual payment-chasing loop — while front-loading data capture so a student portal can ship cleanly in v2?

## Recommended Direction

**Payments-first CRM, anchored on a master student table and batch templates.**

The product's reason to exist is collections automation. Day-1 surface is a "Today" screen plus a master student table with filters and bulk WhatsApp/email actions. Everything else — registration form, batch CRUD, teacher view — exists in service of that table being correct and complete.

Public registration form ships in v1 because it doubles as student signup: form creates a `Student` row plus a dormant `User` row (role=student, no portal access). When v2 ships the student portal, every prior student already has an account — flip a flag, email a password-set link, done. No password collected in v1.

Admin, staff, and teacher logins in v1. Teachers get read-only roster + daily attendance check (cheap to build, gives them a reason to log in). Student portal UI deferred to v2.

## Key Assumptions to Validate

- [ ] **wa.me delivery is reliable enough** — before any code, send 20 reminders manually via wa.me over a week, measure send-through rate. If <90%, rethink WhatsApp strategy.
- [ ] **Admins will retire the Google Sheet** — commit to a cutover date. No dual-running past 2 weeks post-launch.
- [ ] **Teachers will actually log in daily** — ask one teacher this week whether they'd use a read-only roster + attendance check daily, weekly, or never. If "never," cut teacher login from v1.
- [ ] **Payment lifecycle is predictable** — installments are €225 @ admission + €225 @ week 4. Confirm there are no real-world exceptions (deferred payments, refunds, partials) that need modeling now, not later.
- [ ] **Node 16 → 22 upgrade is unblocked** — PLAN.md line 177 still open.

## MVP Scope (v1)

**In:**
- Public registration form (bilingual PT/EN labels per PLAN.md) — creates Student + dormant User
- Staff "Add student" page (same shape, manual entry)
- Auth: admin, staff, teacher (student account dormant). **Permissions:**
  - **Admin:** everything, including user management (invite/deactivate other admins/staff/teachers)
  - **Staff (secretary):** full CRUD on students, batches/turmas, payments, registrations, notifications. *Cannot* manage users.
  - **Teacher:** read-only on own batch(es) + can mark attendance for own batch's sessions. No access to payments or other batches.
- **Admin Users page** — list of all admin/staff/teacher accounts with invite-by-email flow (Supabase Auth invite). Admin assigns role and (for teachers) batch(es). Deactivate (not delete) when someone leaves — preserves audit trail (who collected which payment). No public signup for non-student roles.
- **Master student table** — sortable columns, filters (batch, trainer, payment status [paid/partial/overdue], installment 1 status, installment 2 status, payment method [bank/cash/mixed], days overdue, payment date range, nationality, registered date range), saved views ("Overdue >7 days", "This batch's roster", "Installment 2 owing", "Paid this month"), row selection
- **Bulk actions** on table: Send WhatsApp (queued wa.me links, click-through), Send email (Resend), Mark paid, Export CSV
- **"Today" screen** — overdue installments, payments due this week, new registrations to confirm
- **Batch templates** — "Open July M9" creates Batch + payment 1/2 due dates + registration URL in one click
- Batches/turmas CRUD with rosters — both admin and staff (secretary) can create. **Create form:** course (PLA only in v1, dropdown ready for future courses), code (free text, unique), start_date, start_time (default 14:00), duration (default 4h, derives end_time), trainer (user with role=teacher), capacity (default 25). Submit → 30 classroom + 6 autonomous sessions auto-generated.
- Payments: 2-installment tracking, mark paid, collected-by, overdue flags
- **Payment proof upload** — "Mark paid" dialog captures method (bank/cash), amount, date, collected-by, and (if bank) the proof PDF that the student sent via WhatsApp. Stored in Supabase Storage, linked to the Payment row.
- **Two paths to update payments:**
  - **Inline from master student table** — fast path for the 80% case. Row action opens the mark-paid dialog without leaving the table.
  - **Student detail page** — deep path for complicated cases (partial payments, refunds, corrections, disputes). Shows full payment history across all enrollments, with edit on each row.
- **Student detail page** — personal info, documents (with expiry), enrollments across batches, full payment history, message log (wa.me + email), free-text staff notes, **audit log** (activity stream of who-changed-what-when). The source-of-truth view for one student.
- **Audit log** — every mutation to student-related data (personal info edits, document uploads, enrollments, payments, notes, messages sent) writes an `AuditLog` row capturing: actor user, action, entity, field diffs (old → new), timestamp. Displayed as a reverse-chronological activity stream inside the student detail page. Immutable — no one can edit or delete audit rows, including admins. Implemented via explicit `logChange()` calls in each server action (not silent Prisma middleware) so it can't be accidentally bypassed.
- **Cronograma per batch** — re-designed. Drops the static schedule-table format as the primary view. Each PLA batch = 6 modules, each with 5 classroom days (4h each, default 14:00–18:00) + 5h autonomous work. Total 150 hours. One trainer (Formador) assigned per batch.

  When a batch is created, the system auto-generates 36 `BatchSession` rows: 30 classroom + 6 autonomous, walking forward by the batch's configured weekdays pattern (e.g. Wed→Thu→Fri→Mon→Tue, skipping weekends *and* Portuguese national holidays — `date-holidays` npm).

  **Primary view: 6-module journey + Today card.**
  - Six module cards laid out as a path (vertical on mobile, horizontal/grid on desktop). Each card shows: module name, dates spanned, status (Upcoming / In progress / Done), classroom hours logged vs planned, autonomous-work status.
  - Floating "Today" card pinned at the top while a session is in scope: *Hoje — Módulo 2, 14:00–18:00, X enrolled*. Buttons: Mark held · Take attendance · Cancel · Notes.
  - Click a module card → drill into its 5 sessions + attendance heatmap + autonomous status.

  **Session status (live overlay):** each session is Scheduled / Held (with attendance count) / Cancelled (with reason) / Rescheduled (shows from→to). Makes the cronograma a record of what actually happened, not just what was planned.

  **Reschedule:** simple per-session date edit in v1. Cascade-shift (when one slip moves the rest) deferred to v1.1.

  **Schedule-table view (secondary):** toggle from the journey view. Shows the classic Formadores · Módulos · Datas · H. Início table. Used for print/PDF export at enrolment.

  **iCal feed per batch:** private `.ics` URL. Students/teachers subscribe in Google/Apple Calendar. Auto-updates when sessions are rescheduled.

- **PLA syllabus seeded in code** — 6 modules, hard-coded in a seed script. Editor deferred (see Not Doing).

  PLA modules (nível A1 e A2, 150h total):
  1. Eu e a minha rotina diária
  2. Hábitos alimentares, cultura e lazer
  3. O corpo humano, saúde e serviços
  4. Eu e o mundo do trabalho
  5. O meu passado e o meu presente
  6. Comunicação e vida em sociedade

  No per-lesson topic breakdown — the module is the unit displayed in the cronograma, matching the existing format.
- Teacher view: read-only roster of own turma + daily attendance check
- MessageLog: audit every wa.me click + email send
- 3 hard-coded message templates in code (welcome, payment 1 reminder, payment 2 reminder)
- Document upload (passport/permit, front + back) → Supabase Storage

**Stack adjustments to PLAN.md:**
- **Resend added to v1** (was v2) — needed for bulk email notifications
- **TanStack Table kept** — the master table is where it earns its complexity

## Not Doing (and Why)

- **Student portal UI** — accounts created dormant in v1, portal ships in v2. Data capture is urgent; portal UI is polish.
- **Document expiry automation** — table filter ("expiring <30 days") is enough. No cron, no alerts, no emails. Eyeballed from the filter when needed.
- **MessageTemplate CRUD UI** — 3 templates hard-coded. Build an editor after you've changed a template twice.
- **Meta WhatsApp Cloud API** — wa.me only. 1-2 week Meta verification + per-message cost not justified until volume demands it. `MessagingProvider` interface still in place for v2 swap.
- **True bulk WhatsApp send** — wa.me is fundamentally one-tab-at-a-time. UI shows a click-through queue, not a misleading "Send all" button.
- **PDF email receipts** — plain-text/HTML email is fine for v1. PDF generation is a rabbit hole.
- **Teacher attendance analytics** — teachers mark attendance, that's it. No reports until someone asks.
- **Data import from existing Sheet** — start fresh from the next batch. Cleaner cutover, no garbage migrated.
- **Syllabus editor (Course/Module/Lesson CRUD)** — PLA syllabus is seeded in code. No admin UI to edit module names or lesson topics. Build it the third time someone wants to change a lesson title.
- **Multi-course support** — schema models `Course` as a row, but only PLA is seeded. No UI to add a new course. When a second course is offered, add it via seed + a small admin form then.
- **Cronograma drag-to-reschedule with cascade** — v1 ships simple per-session date edit. Drag-and-drop with auto-cascade (moving one session shifts the rest along the weekday pattern) deferred to v1.1 once the manual reschedule pain is felt.
- **Multi-batch calendar / month overview** — only matters when 3+ batches run concurrently. Build when the pain is real.
- **Per-student personalized cronograma** — students don't have portal access in v1. Personalized progress view ships with the v2 student portal, using the same underlying data.
- **Materials/PDFs per module** — no module-attached resources in v1. Add when trainers ask for it.
- **Trainer conflict detection** — warning when one Formador is double-booked across overlapping batches. Cheap to add, but only relevant when ≥2 concurrent batches with shared trainers. Defer until that scenario is real.
- **Director's dashboard / business reporting** — the "Today" screen covers the urgent half. Full dashboard waits until the table proves itself.

## Future Scope (post-v2)

Captured so today's decisions don't accidentally block tomorrow's needs. **Not building any of this in v1.**

- **Full bookkeeping** — income, expenses, salaries, profit distribution, P&L reports. Will live as a separate `Ledger`/`Transaction` module that ingests from `Payment` (income) and adds expense/salary entries. Today's design choices to keep this path open:
  - Money stored as integer cents, not floats
  - `currency` field on `Payment` (default EUR)
  - `Payment` stays student-installment-shaped — don't generalize to "Transaction" prematurely
- **Student portal** (v2) — read-only at first: see batch, see payment status, download receipts, upload bank proof directly (short-circuits the WhatsApp→staff chain)
- **Meta WhatsApp Cloud API** — automated reminders behind the same `MessagingProvider` interface
- **Multi-course support UI** — when a second course (not PLA) is offered
- **Cronograma drag-cascade reschedule** — when manual rescheduling pain is felt
- **Multi-batch calendar view** — when 3+ concurrent batches make it useful
- **Director's dashboard** — revenue MTD, fill rate, expiring permits, etc. — once the "Today" screen proves itself

## Open Questions

- ~~Does the registration form need a payment step?~~ **Resolved:** no. Payments are bank transfer or cash, recorded out-of-band. Staff attaches the WhatsApp-received bank proof PDF when marking paid. v2 student portal can let students upload proof directly.
- ~~One Supabase project per environment or shared?~~ **Resolved:** two projects on free tier — `horizonte-dev` (safe to wipe/seed) + `horizonte-prod` (real student data). Skip staging until needed.
- ~~Second admin user?~~ **Resolved:** the school secretary, onboarded from day 1. Implies staff-facing flows must be usable by a non-developer: Portuguese copy everywhere, real validation messages, confirmation dialogs on destructive actions, a short "how to use this" cheat-sheet/Loom at launch.
- ~~Email provider + From address?~~ **Resolved:** Resend, sending from `noreply@nhorizonte.pt`. Requires SPF/DKIM/DMARC DNS records on `nhorizonte.pt` at setup time (one-time, ~5 min). Free tier (3k/mo, 100/day) fits the school. Gmail SMTP rejected — daily limits, deliverability, no bounce tracking.
- Who is the second admin user, and when are they onboarded? (Affects how much polish the staff-facing flows need.)
- ~~Teacher attendance granularity?~~ **Resolved:** full — Present / Late / Left early / Excused absence / Unexcused absence, plus a free-text notes field per session. Stored as an enum on the Attendance row so reporting can filter by funder/regulator needs.
- ~~Batch code semantics?~~ **Resolved:** code is an opaque label (letter+number, e.g. M9, J5). Time-of-day is a separate `start_time` field on the batch. Batches run morning / afternoon / evening slots — slot is implied by `start_time`, not parsed from the code.
- ~~Batch weekday pattern?~~ **Resolved:** Mon–Fri (weekdays). Generator walks forward from `start_date`, skipping Sat/Sun and Portuguese national holidays. No per-batch weekday configuration in v1.
- ~~Mid-batch trainer swaps?~~ **Resolved:** allowed. `BatchSession.trainer_user_id` defaults to the batch's primary trainer but can be overridden per session. Admin UI: pick a date, assign new trainer from that date forward.
