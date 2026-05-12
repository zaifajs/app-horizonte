-- Flatten Payment (obligation) + PaymentReceipt (event) into a single
-- Payment table where each row = one money received. Drop the fixed
-- installment structure entirely. Add Batch.feeCents as the total target.

-- 1. Batch gains a total fee in cents (default €450 for PLA).
ALTER TABLE "batches" ADD COLUMN "feeCents" INTEGER NOT NULL DEFAULT 45000;

-- 2. Add the new Payment columns (nullable for now; we'll backfill, then tighten).
ALTER TABLE "payments" ADD COLUMN "amountCents_new"      INTEGER;
ALTER TABLE "payments" ADD COLUMN "method"               "PaymentMethod";
ALTER TABLE "payments" ADD COLUMN "proofStoragePath"     TEXT;
ALTER TABLE "payments" ADD COLUMN "collectedById"        UUID;

-- 3. For every existing receipt, insert a new Payment row carrying its data.
INSERT INTO "payments" (
  "id", "enrollmentId", "amountCents_new", "currency", "paidAt",
  "method", "proofStoragePath", "collectedById", "notes",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  p."enrollmentId",
  r."amountCents",
  p."currency",
  r."paidAt",
  r."method",
  r."proofStoragePath",
  r."collectedById",
  r."notes",
  r."createdAt",
  r."createdAt"
FROM "payment_receipts" r
JOIN "payments" p ON p."id" = r."paymentId";

-- 4. Delete the old "obligation" rows — they had no money attached.
--    (Any row with amountCents_new still NULL is an obligation.)
DELETE FROM "payments" WHERE "amountCents_new" IS NULL;

-- 5. Tighten the new columns; rename amountCents_new → amountCents.
ALTER TABLE "payments" ALTER COLUMN "amountCents_new" SET NOT NULL;
ALTER TABLE "payments" ALTER COLUMN "method" SET NOT NULL;
ALTER TABLE "payments" ALTER COLUMN "paidAt" SET NOT NULL;

-- Drop the obligation/installment columns.
DROP INDEX IF EXISTS "payments_dueDate_idx";
ALTER TABLE "payments" DROP COLUMN "installment";
ALTER TABLE "payments" DROP COLUMN "expectedAmountCents";
ALTER TABLE "payments" DROP COLUMN "paidAmountCents";
ALTER TABLE "payments" DROP COLUMN "dueDate";

-- Rename amountCents_new to amountCents.
ALTER TABLE "payments" RENAME COLUMN "amountCents_new" TO "amountCents";

-- 6. Wire collectedById foreign key.
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_collectedById_fkey"
    FOREIGN KEY ("collectedById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 7. New helpful index.
CREATE INDEX "payments_enrollmentId_idx" ON "payments"("enrollmentId");

-- 8. Drop the receipts table.
DROP TABLE "payment_receipts";
