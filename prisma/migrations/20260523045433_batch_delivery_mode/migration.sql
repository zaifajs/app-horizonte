-- CreateEnum
CREATE TYPE "BatchDeliveryMode" AS ENUM ('IN_HOUSE', 'ONLINE');

-- AlterTable
ALTER TABLE "batches" ADD COLUMN     "deliveryMode" "BatchDeliveryMode" NOT NULL DEFAULT 'IN_HOUSE',
ADD COLUMN     "meetingUrl" TEXT;
