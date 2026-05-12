-- Move the total fee from Batch to Course (course-level decision).

ALTER TABLE "courses" ADD COLUMN "feeCents" INTEGER NOT NULL DEFAULT 45000;

-- Preserve any per-batch fee already set: take the max across each course's
-- batches so courses with mixed fees default to the highest (rare). For
-- single-course setups (PLA only) this is a no-op since the default matches.
UPDATE "courses" c
SET "feeCents" = COALESCE(
  (SELECT MAX(b."feeCents") FROM "batches" b WHERE b."courseId" = c."id"),
  c."feeCents"
);

ALTER TABLE "batches" DROP COLUMN "feeCents";
