# Horizonte CRM — Redesign Brief

Paste this entire document into Claude.ai (or any design AI) at the start of a new conversation. It has everything needed to mock up the redesign without access to the live app.

---

## 1. Product context

**Horizonte CRM** is the staff-facing admin app for **Novo Horizonte**, a Portuguese language school in Porto, Portugal. It replaces a Google Form + Google Sheet workflow used to manage students of the **PLA** (Português Língua de Acolhimento) course.

- **Audience**: school admin staff, teachers, and prospective students (registration form).
- **Course**: PLA — 6 weeks, 5 days/week, €450 total fee (split into 2 installments). Most students are immigrants/expats in Portugal applying for residence; primary languages spoken are Portuguese, English, Bengali, Urdu, Hindi.
- **Brand vibe**: trustworthy, calm, welcoming, professional. Education with warmth. Atlantic / Portuguese influence is welcome (think Porto's azulejo tiles, Atlantic blue, terracotta accents) but not required.
- **Parent brand**: https://nhorizonte.pt (you can reference if helpful, but admin can have its own visual language).

## 2. Current state

- Built with **Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui** (base-nova preset, neutral palette, Lucide icons, Figtree font).
- The look right now is generic shadcn — black/white/grey, no accent color, no brand identity, plain tables, no sidebar, sparse iconography.
- Stack/component constraints are flexible: any shadcn-compatible component or Tailwind utility class is fair game. Avoid pulling in heavy new libs (no Material UI, no Chakra).

## 3. Goal

Bold redesign. Address these pain points specifically:
1. **Colors / palette feel generic** — needs identity.
2. **Tables and forms feel utilitarian** — need hover states, density without crowding, visual hierarchy, micro-icons.
3. **Navigation / layout feels static** — needs sidebar nav, breadcrumbs, maybe command palette. Pages should feel connected.

**Don't redesign every screen.** Pick **3 reference screens** and nail them:
- One **dashboard** (`/admin/today`)
- One **data-heavy listing** (`/admin/students`)
- One **dense detail view** (`/admin/batches/[id]`)

Once those three are designed, the patterns should be replicable across the rest. Deliverable: HTML+CSS mockups (single-file ok) or screenshots of designed frames.

## 4. Roles & audiences

| Role | Pages they see |
|---|---|
| **Admin / Staff** | All `/admin/*` pages. Power users. Density preferred over whitespace. |
| **Teacher** | `/teacher/*` only. Lighter UX, classroom-friendly (used on tablets). |
| **Public** | `/register`, `/turma/[id]` (cronograma). Multilingual (PT primary, EN/BN/UR/HI). |

## 5. Data model (essential entities)

```
Course           PLA · 6 modules · €450
  └── Module     M1..M6 · 5 classroom days + 1 homework block each
Batch            code (e.g. M32), trainer, startDate, capacity, status
  └── BatchSession   ~36 sessions per batch · CLASSROOM | AUTONOMOUS
  └── Enrollment     student ↔ batch · PENDING | ACTIVE | WITHDRAWN | COMPLETED
       └── Payment   €amount · BANK | CASH · paidAt
Student          name, email, phone, nationality, NIF, doc info, docs (front/back uploads)
Attendance       per (session, enrollment): PRESENT | LATE | LEFT_EARLY | EXCUSED_ABSENCE | UNEXCUSED_ABSENCE
User             ADMIN | STAFF | TEACHER | STUDENT
```

## 6. Page-by-page brief

Each page below: **purpose · sections · demo data**. Use the demo data verbatim in mockups so they feel real.

---

### A. PUBLIC

#### `/[locale]/(public)/page.tsx` — Landing
- Purpose: announce the app exists, direct to /register.
- Currently minimal. Could be a hero + CTA + a few trust signals.

#### `/[locale]/(public)/register/page.tsx` — Student registration form
- Purpose: prospective student fills out personal info + uploads documents (residence permit or passport, front + back).
- Form fields (long):
  - Nome completo, email, phone (WhatsApp), date of birth, nationality
  - Tipo de documento (Passport / Residence Permit / ID), número, data de validade
  - Upload front, upload back (optional)
  - NIF (tax ID), NISS (social security, optional), morada, localidade
  - **Batch select** — picks from upcoming batches
  - **GDPR consent checkbox** (required)
- Demo content: bilingual labels (PT primary, EN helper underneath). Submit → success page.

#### `/[locale]/(public)/turma/[id]/page.tsx` — Public batch schedule (cronograma)
- Purpose: prospective and current students see when their batch meets.
- Shows: course name, batch code, start date, full 6-week schedule as a modules×sessions grid.
- Demo: same as Batch detail below, but read-only and unbranded with internal numbers.

---

### B. AUTH

#### `/login` — Email + password sign-in
- Simple form. Add a "Forgot password?" link.

#### `/auth/set-password` — First-time set-password after invite
- Title: "Set your password". Two fields (new, confirm). Submit → /admin.

#### `/forbidden` — 403
- "You don't have access to this area. Sign in with a different account."

---

### C. ADMIN (English only — staff tool)

#### `/admin` — Index
- Redirects to `/admin/today`.

#### `/admin/today` — Operational dashboard
- Purpose: the "what needs my attention today" page. Open this first thing in the morning.
- Sections:
  1. **Stats row** (4 cards): Active students · Active batches · Pending payments (€) · Overdue (count)
  2. **Three actionable lists**, each ~5 rows max:
     - **Overdue payments** — name, batch, amount due, days overdue
     - **Documents expiring soon** — name, doc type, expiry date, days until expiry
     - **Pending enrollments** (no payment yet) — name, batch, days since enrolled
- Demo data:

```json
{
  "stats": {
    "activeStudents": 87,
    "activeBatches": 4,
    "pendingPaymentsEur": 1875,
    "overdueCount": 3
  },
  "overdue": [
    { "name": "Aisha Martins", "batch": "M32", "amountEur": 225, "daysOverdue": 12 },
    { "name": "Hassan Oliveira", "batch": "M32", "amountEur": 225, "daysOverdue": 5 },
    { "name": "Inês Pereira", "batch": "J3", "amountEur": 450, "daysOverdue": 2 }
  ],
  "expiring": [
    { "name": "Omar Almeida", "doc": "Residence Permit", "expiresOn": "2026-06-10", "daysLeft": 19 },
    { "name": "Nadia Khan", "doc": "Passport", "expiresOn": "2026-07-02", "daysLeft": 41 }
  ],
  "pendingEnrollments": [
    { "name": "Luísa Oliveira", "batch": "J5", "daysSinceEnrolled": 3 },
    { "name": "Mariana Ahmed", "batch": "J5", "daysSinceEnrolled": 6 }
  ]
}
```

---

#### `/admin/students` — Student list (main workhorse)
- Purpose: find + manage students. Most-visited admin page.
- Sections:
  1. **Header**: page title, "+ New student" CTA, bulk-actions row (when items selected)
  2. **Filters bar**: batch select, status select (PENDING/ACTIVE/WITHDRAWN/COMPLETED), payment state (paid/partial/overdue), search by name/email/phone
  3. **Table**: checkbox · serial # (per batch) · name · batch · payment status pill · phone (with WhatsApp icon link) · enrolled date · actions (drawer / edit / message)
  4. **Bulk WhatsApp queue** sidebar/panel when rows selected — pick a template, send via wa.me
  5. Clicking a row opens a **slide-in drawer** with full student detail (intercepting route pattern)
- Urgency tints currently used: green-50 (paid), amber-50 (partial), orange-100 (due_soon), red-100 (overdue)
- Demo data (10 rows):

```json
[
  { "id": "1", "seq": 1, "name": "Aisha Martins", "batch": "M32", "paymentState": "overdue", "phone": "+351912345678", "enrolledAt": "2026-04-12", "status": "ACTIVE" },
  { "id": "2", "seq": 2, "name": "Omar Almeida", "batch": "M32", "paymentState": "paid", "phone": "+351912000222", "enrolledAt": "2026-04-13", "status": "ACTIVE" },
  { "id": "3", "seq": 3, "name": "Mariana Ahmed", "batch": "M32", "paymentState": "partial", "phone": "+351911223344", "enrolledAt": "2026-04-15", "status": "ACTIVE" },
  { "id": "4", "seq": 4, "name": "Hassan Oliveira", "batch": "M32", "paymentState": "overdue", "phone": "+351933112233", "enrolledAt": "2026-04-15", "status": "ACTIVE" },
  { "id": "5", "seq": 5, "name": "Omar Hussain", "batch": "M32", "paymentState": "paid", "phone": "+351966554433", "enrolledAt": "2026-04-16", "status": "ACTIVE" },
  { "id": "6", "seq": 6, "name": "Nadia Khan", "batch": "M32", "paymentState": "paid", "phone": "+351912777111", "enrolledAt": "2026-04-17", "status": "ACTIVE" },
  { "id": "7", "seq": 7, "name": "Aisha Hossain", "batch": "M32", "paymentState": "partial", "phone": "+351933888222", "enrolledAt": "2026-04-18", "status": "ACTIVE" },
  { "id": "8", "seq": 8, "name": "Aisha Costa", "batch": "M32", "paymentState": "paid", "phone": "+351966444555", "enrolledAt": "2026-04-18", "status": "ACTIVE" },
  { "id": "9", "seq": 9, "name": "Luísa Oliveira", "batch": "J5", "paymentState": "due_soon", "phone": "+351911999000", "enrolledAt": "2026-05-12", "status": "PENDING" },
  { "id": "10", "seq": 10, "name": "Inês Pereira", "batch": "J5", "paymentState": "due_soon", "phone": "+351922888777", "enrolledAt": "2026-05-13", "status": "PENDING" }
]
```

---

#### `/admin/students/new` — Enroll new student
- A long form (same fields as public registration). Has additional "Enroll into batch" + "Record first payment now" affordances.
- Treat as a paired form layout (2-column or 1-column with grouped sections).

#### `/admin/students/[id]` — Student detail
- Purpose: full record of one student.
- Sections:
  1. **Header**: name, status badge, contact icons (phone, email, WhatsApp button)
  2. **Personal info card**: DOB, nationality, NIF, NISS, doc type/number/expiry, address
  3. **Documents**: thumbnails of uploaded passport/residence permit front+back
  4. **Enrollments**: list of (current + past) batches. Each enrollment expands into:
     - Payment progress bar (€225 / €450 etc.) + per-payment list (amount, method, paidAt, verified, proof attached)
     - "Record payment" button
  5. **Send message panel**: pick a template, edit, send WhatsApp / email
- Demo:

```json
{
  "student": {
    "name": "Aisha Martins", "email": "aisha@example.com", "phone": "+351912345678",
    "dob": "1992-03-14", "nationality": "Bangladeshi",
    "nif": "123456789", "niss": "11234567890",
    "doc": { "type": "Residence Permit", "number": "RP1234567", "expiresOn": "2027-01-15" },
    "address": "Rua de Cedofeita 123, Porto"
  },
  "enrollments": [
    {
      "batch": "M32", "status": "ACTIVE", "enrolledAt": "2026-04-12",
      "feeEur": 450, "paidEur": 225,
      "payments": [
        { "amountEur": 225, "method": "BANK", "paidAt": "2026-04-12", "verified": true, "hasProof": true }
      ]
    }
  ]
}
```

---

#### `/admin/students/[id]/edit` — Edit form. Same form as /new, prefilled.

#### `/admin/batches` — Batch list
- Sections: header + "+ New batch" CTA, table of batches with code · course · trainer · start date · #enrolled / capacity · status badge · row actions
- Demo:

```json
[
  { "code": "M32", "course": "PLA", "trainer": "Pedro Santos", "startDate": "2026-05-18", "enrolled": 10, "capacity": 25, "status": "ACTIVE" },
  { "code": "J5", "course": "PLA", "trainer": null, "startDate": "2026-06-08", "enrolled": 2, "capacity": 25, "status": "UPCOMING" },
  { "code": "J3", "course": "PLA", "trainer": "Maria Sousa", "startDate": "2026-03-02", "enrolled": 18, "capacity": 25, "status": "FINISHED" }
]
```

#### `/admin/batches/new` — Create batch form
- Fields: course select, batch code, start date, start time, hours/day, capacity, optional trainer.

#### `/admin/batches/[id]` — Batch detail (KEY REFERENCE PAGE)
- Purpose: trainers/admin see the cronograma at a glance + roster shortcut.
- Sections:
  1. **Header**: "Batch M32" + status badge · subtitle (course code, name, level) · actions row (Export active students · Roster · Attendance · Compact · Calendar · Back)
  2. **"Today" card** (only if a session is scheduled today): module #, time range, module name
  3. **Stats grid** (8 small cards): Starts · Ends est. · Time · Trainer (now editable inline dropdown) · Capacity · Enrolled · Classroom sessions · Autonomous blocks
  4. **Modules grid** (6 cards): each shows MODULE N, name, date range, status (Upcoming / In progress / Done), hours logged/planned
  5. **Per-module section** (×6): table of classroom sessions + the autonomous block, with date, time, hours, status
- Demo:

```json
{
  "batch": { "code": "M32", "status": "ACTIVE", "course": { "code": "PLA", "name": "Português Língua de Acolhimento", "level": "A2" } },
  "stats": {
    "starts": "2026-05-18", "endsEst": "2026-06-26", "time": "18:00–22:00",
    "trainer": "Pedro Santos", "capacity": 25, "enrolled": 10,
    "classroomSessions": 30, "autonomousBlocks": 6
  },
  "modules": [
    { "n": 1, "name": "Eu e a minha rotina diária", "first": "2026-05-18", "last": "2026-05-22", "status": "DONE", "hoursLogged": 20, "hoursPlanned": 20 },
    { "n": 2, "name": "Hábitos alimentares, cultura e lazer", "first": "2026-05-25", "last": "2026-05-29", "status": "IN_PROGRESS", "hoursLogged": 12, "hoursPlanned": 20 },
    { "n": 3, "name": "A cidade e os transportes", "first": "2026-06-01", "last": "2026-06-05", "status": "UPCOMING", "hoursLogged": 0, "hoursPlanned": 20 },
    { "n": 4, "name": "Saúde e bem-estar", "first": "2026-06-08", "last": "2026-06-12", "status": "UPCOMING", "hoursLogged": 0, "hoursPlanned": 20 },
    { "n": 5, "name": "Trabalho e cidadania", "first": "2026-06-15", "last": "2026-06-19", "status": "UPCOMING", "hoursLogged": 0, "hoursPlanned": 20 },
    { "n": 6, "name": "Portugal e a sua cultura", "first": "2026-06-22", "last": "2026-06-26", "status": "UPCOMING", "hoursLogged": 0, "hoursPlanned": 20 }
  ]
}
```

#### `/admin/batches/[id]/attendance` — Batch attendance matrix
- Toggle layout: Students × Sessions (default) or Sessions × Students.
- Cells: P/L/E/X/A colored chips, or `—` for unmarked.
- Sticky first column. Per-student attendance rate column on the right.
- Demo: see same students from /admin/students above; 30 classroom sessions; mostly P with occasional L/A.

#### `/admin/users` — User management
- Sections: header + "Invite user" CTA, table of users (name, email, role, active status, last sign-in, actions).
- Row actions: role select (Admin / Staff / Teacher), Deactivate/Reactivate button, Delete (trash icon).
- All destructive actions prompt a styled confirm dialog.
- Demo:

```json
[
  { "name": "Huzaifa Ahmed", "email": "hahmed@ext.thetripboutique.co", "role": "ADMIN", "isActive": true, "isSelf": true },
  { "name": "Pedro Santos", "email": "pedro@nhorizonte.pt", "role": "TEACHER", "isActive": true, "isSelf": false },
  { "name": "Maria Sousa", "email": "maria@nhorizonte.pt", "role": "TEACHER", "isActive": true, "isSelf": false },
  { "name": "Ana Silva", "email": "ana@nhorizonte.pt", "role": "STAFF", "isActive": false, "isSelf": false }
]
```

---

### D. TEACHER (English UI — runs in classroom, often on tablet)

#### `/teacher` — Teacher landing
- "My batches" grid. Each card: batch code, course, next session date/time, enrolled count.

#### `/teacher/batches/[id]` — Teacher batch view
- Responsive grid of all 36 sessions (CLASSROOM + AUTONOMOUS).
- Each tile: module #, module name, date, time, status badge, "X marked" if HELD.
- "Today" tile is highlighted (border + light background).
- Top-right buttons: Attendance, Back.

#### `/teacher/batches/[id]/attendance` — Same as admin matrix, but scoped to teacher's own batch.

#### `/teacher/sessions/[id]` — Mark attendance (THE most-used teacher screen)
- Sections:
  1. **Header**: "Mon 18 May 2026" + session status badge · subtitle "Batch M32 · M1 · Eu e a minha rotina diária · 18:00–22:00"
  2. **"Mark all" toolbar**: Mark all → [Present] [Late] [Left early] [Excused] [Absent] · stats summary on right
  3. **Student grid** (1–3 columns responsive). Each card:
     - Student name + small "+ Note" button (highlights when note exists)
     - 5 status pills (Present / Late / Left early / Excused / Absent), one highlights when selected
     - Optional inline note input (collapsed by default)
     - **Unmarked cards have a dashed amber border** — visual reminder
  4. **Session notes** textarea (optional, multi-line)
  5. **Save attendance** button (disabled until everyone has a status)
- Demo: 10 students from above, all start unmarked. Teacher clicks "Mark all Present", then changes 1 to Late, 1 to Absent, then Saves.

---

## 7. Key interactions to preserve in mockups

These are the moments where UX matters most. The redesign needs to make them feel **fast** and **obvious**:

- **Mark attendance for 10 students in <15s** (the "Mark all Present" + a few exceptions flow).
- **Record a payment** from the student row in the table (currently opens a dialog).
- **Send WhatsApp** — one click on student row, wa.me opens with pre-filled message.
- **Open student drawer** — click a row in /admin/students → slide-in drawer.
- **Switch attendance matrix layout** — small toggle pill at top of `/admin/batches/[id]/attendance`.

## 8. What to design

Deliverables (in priority order):

1. **`/admin/today` mockup** — establish dashboard vibe (stats cards, list of alerts).
2. **`/admin/students` mockup** — establish the data-table pattern (filters, urgency tints, density).
3. **`/admin/batches/[id]` mockup** — establish dense detail page pattern (stats grid, module cards, per-module tables).
4. **Sidebar nav** — the global app shell. Currently top-only; should become a left sidebar with:
   - Logo + school name
   - Sections: Today · Students · Batches · Users
   - User menu / sign out at bottom
5. **Color palette + typography spec** — give 1 primary, 1 accent, neutrals, and 4-5 semantic colors (success / warning / danger / info / muted). Suggest a heading + body font pairing that handles Portuguese (ã, ç, õ) gracefully.
6. **Bonus**: a `/teacher/sessions/[id]` attendance grid mockup — that's the most-clicked screen by teachers.

Once those are designed, the rest of the app can be inferred and rebuilt from the patterns.

## 9. Hard constraints

- **Tech**: HTML + Tailwind CSS only (no MUI, Chakra, Bootstrap). Lucide icons. Shadcn-compatible.
- **Accessible**: target WCAG AA color contrast. Don't rely solely on color for status (always pair with text/icon).
- **Mobile-friendly**: teacher pages must work on iPad. Admin pages can be desktop-first but shouldn't break below 1024px.
- **No emojis in the UI**.
- **Multilingual-safe**: leave room for Portuguese strings (longer than English by ~20%).

## 10. Output format

For each mockup, please provide:
1. **A single HTML file** with inline `<style>` (or Tailwind CDN) so it renders standalone.
2. **A short rationale**: what you decided about palette, type, layout, and why.
3. **CSS variables / tokens block** at the top of the file so I can lift it directly into the real codebase.

Thanks!
