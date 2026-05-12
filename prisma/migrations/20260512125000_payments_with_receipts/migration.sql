-- Split Payment into Payment (obligation) + PaymentReceipt (each money-received event)
-- so partial payments are first-class.

-- 1. Add the new "expected" column as NULLABLE, backfill from the old amount,
--    then enforce NOT NULL.
ALTER TABLE "payments" ADD COLUMN "expectedAmountCents" INTEGER;
UPDATE "payments" SET "expectedAmountCents" = "amountCents";
ALTER TABLE "payments" ALTER COLUMN "expectedAmountCents" SET NOT NULL;

-- 2. New paid-amount cache; recomputed by the addPaymentReceipt server action.
ALTER TABLE "payments" ADD COLUMN "paidAmountCents" INTEGER NOT NULL DEFAULT 0;

-- 3. Create the receipts table.
CREATE TABLE "payment_receipts" (
  "id"               UUID NOT NULL,
  "paymentId"        UUID NOT NULL,
  "amountCents"      INTEGER NOT NULL,
  "paidAt"           TIMESTAMP(3) NOT NULL,
  "method"           "PaymentMethod" NOT NULL,
  "proofStoragePath" TEXT,
  "collectedById"    UUID,
  "notes"            TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_receipts_paymentId_idx" ON "payment_receipts"("paymentId");

ALTER TABLE "payment_receipts"
  ADD CONSTRAINT "payment_receipts_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "payment_receipts_collectedById_fkey"
    FOREIGN KEY ("collectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Migrate any existing single-payment rows that were already marked paid
--    into a receipt under the same payment. (Dev data had 0 paid rows; safe.)
INSERT INTO "payment_receipts" ("id", "paymentId", "amountCents", "paidAt", "method", "proofStoragePath", "collectedById", "notes", "createdAt")
SELECT
  gen_random_uuid(),
  p."id",
  p."amountCents",
  p."paidAt",
  COALESCE(p."method", 'BANK'::"PaymentMethod"),
  p."proofStoragePath",
  p."collectedById",
  p."notes",
  COALESCE(p."paidAt", p."createdAt")
FROM "payments" p
WHERE p."paidAt" IS NOT NULL;

-- 5. Update the paid-amount cache on payments that had legacy paid rows.
UPDATE "payments" p
SET "paidAmountCents" = COALESCE(s.total, 0)
FROM (
  SELECT "paymentId", SUM("amountCents") AS total
  FROM "payment_receipts"
  GROUP BY "paymentId"
) s
WHERE s."paymentId" = p."id";

-- 6. Drop the relocated columns and the old foreign key.
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_collectedById_fkey";
ALTER TABLE "payments" DROP COLUMN "amountCents";
ALTER TABLE "payments" DROP COLUMN "method";
ALTER TABLE "payments" DROP COLUMN "proofStoragePath";
ALTER TABLE "payments" DROP COLUMN "collectedById";
