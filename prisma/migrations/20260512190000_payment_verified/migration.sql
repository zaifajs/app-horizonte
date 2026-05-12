ALTER TABLE "payments" ADD COLUMN "isVerified"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "payments" ADD COLUMN "verifiedAt"   TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN "verifiedById" UUID;
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_verifiedById_fkey"
    FOREIGN KEY ("verifiedById") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
