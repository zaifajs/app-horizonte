# Horizonte CRM — Plan

School management software for Novo Horizonte language school. Replaces the current Google Form + Google Sheet workflow.

- Domain: planned `app.nhorizonte.pt` (main site: https://nhorizonte.pt)
- Repo location: `/Users/huzaifa/Sites/horizonte-crm`

---

## Course context (as of 2026-05)

- Only course offered: **PLA**
- Duration: **6 weeks, 5 days/week**
- Fee: **€450 total**, split as **€225 at admission + €225 after week 4**
- Batch naming: `[Month letter][Number]` e.g. `J5` = June batch 5; time-slot codes like `M9` (morning 9am), `M10` (morning 10am)
- Communication: WhatsApp (currently manual)

---

## MVP scope (v1)

**Ships in v1:**
- Public registration form (replaces Google Form) + staff "Add student" page
- Student records with document uploads (passport / residence permit, front + back)
- Batches / Turmas CRUD with rosters
- Payments: 2-installment tracking, mark paid, "collected by", overdue flags
- WhatsApp via `wa.me` links — message templates with placeholders (`{{name}}`, `{{amount}}`, `{{batch}}`), one click to send from WhatsApp Web/mobile
- Admin dashboard (active turmas, pending payments, new registrations)
- Auth: login for admin staff

**Deferred to v2 (architected for, not built):**
- Teacher accounts + per-turma attendance
- Student portal (view batch info, payment status, download receipts)
- Meta WhatsApp Cloud API (swap-in behind the same `sendMessage()` interface)
- Email receipts (PDF) via Resend
- Document expiry alerts (residence permits)

---

## Roles

- **Admin** — full access (you + other admin staff)
- **Teacher** — sees only their turma's roster + attendance, no payments _(v2)_
- **Student** — portal access to own info, payment status, receipts _(v2)_

---

## Stack

- **Next.js 15 + TypeScript** (App Router) — admin UI + API in one repo
- **Supabase** — Postgres + Auth + Storage (document uploads). Free tier.
- **Prisma** — schema + migrations
- **shadcn/ui + Tailwind + TanStack Table** — admin UI
- **Zod + react-hook-form** — form validation (Portuguese + English labels)
- **Resend** — transactional email _(v2)_
- **Hosting**: Vercel (free), DB Supabase (free)

---

## Data model

```
User            id, email, password_hash, role(admin|teacher|student), created_at
Student         id, full_name, email, phone, doc_type, doc_number, dob,
                doc_expiry, nationality, nif, niss, address, city,
                gdpr_consent_at, doc_front_url, doc_back_url, notes, created_at
Batch           id, code (J5, M10), course (PLA), start_date, end_date,
                time_slot, teacher_id, capacity, status (upcoming|active|finished)
Enrollment      id, student_id, batch_id, enrolled_at   (join table — students can re-enroll)
Payment         id, enrollment_id, installment (1|2), amount, due_date,
                paid_at, collected_by, method, notes
MessageLog      id, student_id, template_used, body, sent_via (wa.me|cloud),
                sent_by_user_id, sent_at   (audit even for wa.me clicks)
MessageTemplate id, name, body_with_placeholders
```

Student is separate from Enrollment so a student's history across batches is preserved.

---

## Registration form fields

Bilingual labels (Portuguese primary, English helper) to match the current Google Form.

| Field | Required | Notes |
|---|---|---|
| Nome [Full name] | yes | |
| E-mail Address | yes | |
| Phone [WhatsApp Number] | yes | E.164 format, used for wa.me links |
| Tipo de Documento [Document Type] | yes | Passport / Residence Permit / ID |
| N.º Doc. Identificação [Passport or ID Number] | yes | |
| Data De Nascimento [Date of Birth] | yes | |
| Upload Valid Residence Permit or Passport | yes | Simple file upload → Supabase Storage |
| Valid Residence Permit or Passport (2nd Page) | optional | Simple file upload |
| Data de validade [Document Expiry Date] | yes | |
| Nacionalidade [Nationality] | yes | |
| Contribuinte n.º [Tax ID Number / NIF] | yes | |
| Morada [Address] | yes | |
| Localidade [City/Town] | yes | |
| Batch | yes | Select from active/upcoming batches |
| NISS [Social Security Number] | optional | |
| GDPR Consent [Consentimento RGPD] | yes | Required checkbox, timestamp on save |

---

## WhatsApp strategy

**v1 — `wa.me` links** (free, zero setup, ships tomorrow)
- App generates `https://wa.me/351...?text=<urlencoded message>`
- Staff clicks button next to a student → WhatsApp opens with message pre-filled → click send
- Every click logged to `MessageLog` for audit
- Message templates with placeholders managed in admin UI

**v2 — Meta WhatsApp Cloud API** (automated reminders)
- Requires Meta Business verification (1–2 weeks lead time)
- Pre-approved template messages
- Per-message cost (~€0.03–0.08 in Portugal)
- Only freely-message users who messaged you in last 24h; otherwise must use templates

**Skipped: unofficial libraries** (Baileys, whatsapp-web.js) — against WhatsApp ToS, risk of number ban.

**Abstraction so v2 is a small change:**
```ts
interface MessagingProvider {
  send(to: string, body: string): Promise<{ via: 'wa.me' | 'cloud'; url?: string }>
}
```
All callers (`sendPaymentReminder`, `sendWelcome`, …) use this interface. v2 swaps the implementation.

---

## Scaffold steps (when Node is upgraded)

1. `git init` + initial commit
2. `npx create-next-app@latest . --typescript --tailwind --app --eslint --src-dir --import-alias "@/*"`
3. Install: `prisma @prisma/client @supabase/supabase-js @supabase/ssr zod react-hook-form @hookform/resolvers lucide-react`
4. Add shadcn/ui: button, input, table, form, dialog, select, toast
5. Create `prisma/schema.prisma` per data model above
6. Folder layout:
   ```
   src/
     app/
       (public)/register/page.tsx          ← public registration form
       (admin)/
         layout.tsx                         ← auth-gated
         dashboard/page.tsx
         students/...
         batches/...
         payments/...
         messages/templates/page.tsx
       api/...
     lib/
       db.ts                                ← prisma client
       supabase/                            ← server + browser clients
       messaging/                           ← sendMessage abstraction → wa.me impl
       validators/                          ← zod schemas, bilingual labels
   ```
7. `.env.example` with `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

---

## Supabase setup walkthrough

1. Sign up at https://supabase.com (free)
2. New project → region **West EU (Ireland) `eu-west-1`** for low latency from Portugal
3. Set a strong DB password and save it
4. From **Project Settings → Database**: copy the connection string (transaction pooler URL → `DATABASE_URL`, direct connection → `DIRECT_URL`)
5. From **Project Settings → API**: copy Project URL → `NEXT_PUBLIC_SUPABASE_URL`, anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`, service_role key → `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose)
6. **Storage → Create bucket**: name `student-documents`, set **private**
7. In repo: `npx prisma migrate dev --name init` creates tables
8. Create first admin user via Supabase Auth dashboard, then run a small seed script to set their role to `admin` in our `User` table

---

## Pre-scaffold blockers

- [ ] **Node ≥ 18.18** (currently v16.15.1 — must upgrade). Recommended: Node 22.
  - With nvm: `nvm install 22 && nvm use 22`
  - With brew: `brew install node@22 && brew link --overwrite node@22`
- [ ] Supabase account created
- [ ] DNS access for `nhorizonte.pt` (to point `app.nhorizonte.pt` CNAME to Vercel at deploy time)

---

## Decisions made

- Registration: **both** public form and staff manual entry
- WhatsApp: **wa.me links only** in v1, abstraction in place for Cloud API later
- Users: admin staff + teachers + student portal (only admin in v1; others scaffolded for v2)
- Scope: **MVP** — students + batches + payments + wa.me
- Data import: skip — start fresh from next batch
- Document handling: simple file upload (no OCR, no preview gymnastics)
- Subdomain: `app.nhorizonte.pt`
