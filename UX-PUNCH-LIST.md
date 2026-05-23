# UX punch list — Horizonte CRM

Source: grounded screenshot review + workflow review (admin/teacher/public). 32 open items.

Priority key:
- **P0** — data risk, broken affordance, or actively confusing
- **P1** — high-impact UX win, small/medium effort
- **P2** — polish, inconsistencies, small wins
- **P3** — bigger projects (multi-day)
- **P4** — nice-to-haves

Update as items complete. One-line note on what changed + commit hash if landed.

---

## P0 — Critical

- [x] **#9 Hide "Record another payment" when fully paid.** `enrollment-payments.tsx` — wraps `<QuickPay>` in `{fullyPaid ? null : …}`.
- [x] **#10 Hid the 3 disabled bulk-action buttons.** `selection-ribbon.tsx` — keeping a code-comment marker for when the server actions ship.
- [x] **#11 Bulk send throttle + cancel + progress.** `message-composer.tsx` — 700ms gap between sends, ref-backed abort, footer progress bar + Cancel button. **Follow-up:** even with throttling, Chrome's popup blocker caps consecutive `window.open` calls. The robust fix is a manual-advance pattern ("Send next" button per recipient) — track separately.

## P1 — High-impact UX

- [x] **#12 Edit button in student drawer header.** `student-drawer.tsx` — primary Edit + ghost View full details.
- [x] **#15 Batch section moved to top of Edit student.** `edit-student-form.tsx`.
- [x] **#19 Soft-rail policy.** `students-table.tsx` — overdue ≤ 7d demotes to amber; ≥ 8d stays red. Default rail opacity dropped from 1 → 0.85.
- [x] **#13 Student detail header actions.** `[id]/page.tsx` — added Open-batch link (when enrolled) + Message anchor (scrolls to Send message section) alongside Edit/Back.
- [x] **#23 Message icon in student drawer header.** `student-drawer.tsx` — smooth-scrolls to `#drawer-send-message` section.

## P2 — Polish & inconsistency

- [x] **#20 Today dashboard compressed.** `today/page.tsx` — KPI cards converted to a `StatStrip` helper (3xl number, single sub-line, no chip clutter). Cuts ~80–120px of header height.
- [x] **#26 Batches list course column.** `batches/page.tsx` — code · level on first line; full course name truncated on a smaller second line with `title` tooltip.
- [x] **#27 Users page progressive destructive.** `user-actions.tsx` — Delete button only renders when the user is already deactivated. Forces the safer path first.
- [x] **#33 Top-bar `+ new` is context-aware.** `top-bar.tsx` — `newButtonFor(pathname)` decides target; hidden entirely on Templates/Users where each page has its own "new" affordance.
- [x] **#22 Students-list search row moved above the segmented strips.** `students/page.tsx`.
- [x] **#21 Two strips labelled "Enrolment" and "Payment".** `students/page.tsx` — hz-mono caption above each `.seg`, so new users see what they filter.
- [x] **#24 QuickPay chip click flash.** `quick-pay.tsx` + `globals.css` — chip click bumps a counter that re-keys the amount label and fires `@keyframes hzAmountFlash` (border + ring pulse).
- [x] **#25 QuickPay grid `items-end`.** `quick-pay.tsx` — Paid-on and Proof inputs now share the same baseline even though their labels have different heights.
- [x] **#16 Composer chip hover shows per-recipient values.** `message-composer.tsx` — chip `title` now reads `{{name}} → Aisha · Maria · John (+4 more)` built from `recipients`.
- [x] **#17 Templates editor inserts at cursor.** `templates-editor.tsx` — new `insertAtCursor` helper splices at `selectionStart/End`, then restores focus + caret with `requestAnimationFrame`.
- [x] **#18 Templates editor diff view.** `templates-editor.tsx` — `DiffPanel` + `DiffBlock` side-by-side red/green panes; toggle via "View diff" link when there are unsaved changes.

## P3 — Bigger projects

- [x] **#14 Add/Edit student drawer scaffolding.** Both `new-student-form.tsx` and `edit-student-form.tsx` — sticky `SectionNav` at top with numbered jump chips; `Section` accepts `id` and `scroll-mt`; sticky Save bar at the bottom of the form's scroll container with hair-t border.
- [x] **#30 Public /register multi-step wizard.** `register-form.tsx` + 5 locale files — 4-step wizard with numbered progress, per-step validation gate, back/next + final submit. Save-and-resume across reloads still pending (track separately).
- [x] **#31 Public /register GDPR promoted.** `register-form.tsx` — dedicated card on the final step with title + body text + lime-on-consent state; replaces the tiny bottom-of-page checkbox.
- [x] **#28 Teacher landing "Up next" fallback.** `teacher/page.tsx` — when no session today, surfaces the soonest future scheduled session with date / module / start time / "in N days" or "tomorrow".
- [x] **#29 "Mark all present" promoted.** `attendance-form.tsx` — primary button at the head of the toolbar; the other 4 states demoted to smaller secondary chips. Matches the 90% workflow.
- [x] **#6 Forgot password.** `login-form.tsx` — link toggles the form into a Reset mode that calls `supabase.auth.resetPasswordForEmail(email, { redirectTo })`. Success state shows confirmation.
- [x] **#7 Overdue table action icons.** `today/page.tsx` — added `aria-label` + name-bearing `title` to WhatsApp and record-payment buttons.
- [x] **#8 Dashboard activity feed shows student name.** `today/page.tsx` — `student` relation joined on AuditLog query; `describeAudit` renders "for <Student> · added by <Actor>" + added MessageLog/Messaging/Template cases.
- [ ] **#32 First-time login** — empty-state hand-holding or one-time tour. Bigger work, deferred.

## P4 — Nice-to-haves

- [ ] **#34 Sidebar `[` shortcut hint** (tooltip on collapse button).
- [ ] **#35 Templates preview reflow** ("Obrigado." dangling on own line).
- [ ] **#36 Public /turma/[id] printable PDF.**
- [ ] **#37 Teacher attendance swipe gestures** (left=present, right=absent).

---

## Done in this pass

- [x] **#1 Admin tour — batch-detail selector** scoped to main content + uses `goto(href)`. `e2e/admin-tour.spec.ts`.
- [x] **#2 New batch — Course dropdown** now renders `${code} — ${name}` via SelectValue children fn. `new-batch-form.tsx`.
- [x] **#3 New batch — Trainer dropdown** renders trainer name / "Unassigned" instead of `__unassigned__`. `new-batch-form.tsx`.
- [x] **#4 Same Select-leaks-raw-value bug fix across 10 forms** — trainer-assign, new-student, edit-student, register-form, session-row, user-actions, invite-user-dialog, bulk-whatsapp-queue, locale-switcher. Pattern: `<SelectValue>{(v) => label(v)}</SelectValue>`.
- [x] **#5 Activity feed humanized** — added cases for `MessageLog`, legacy `Messaging`, `User`, `MessageTemplate`. Headlines read like "Sent Payment reminder via WhatsApp"; detail list Title-Cases keys and skips internal fields. `activity-stream.tsx`.
