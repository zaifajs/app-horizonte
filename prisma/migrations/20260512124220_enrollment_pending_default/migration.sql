-- AlterEnum
ALTER TYPE "EnrollmentStatus" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "enrollments" ALTER COLUMN "status" SET DEFAULT 'PENDING';
