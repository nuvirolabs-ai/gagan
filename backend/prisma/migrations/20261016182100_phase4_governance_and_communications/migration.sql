-- CreateEnum
CREATE TYPE "BroadcastPriority" AS ENUM ('normal', 'urgent');

-- CreateEnum
CREATE TYPE "BroadcastAudience" AS ENUM ('all_users', 'all_salespeople', 'all_retailers', 'city');

-- CreateEnum
CREATE TYPE "BroadcastStatus" AS ENUM ('draft', 'scheduled', 'sent', 'cancelled');

-- AlterTable
ALTER TABLE "Role" ADD COLUMN "color" TEXT DEFAULT '#1e40af',
ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Permission" ADD COLUMN "category" TEXT;

-- CreateTable
CREATE TABLE "BroadcastMessage" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "priority" "BroadcastPriority" NOT NULL DEFAULT 'normal',
    "audience" "BroadcastAudience" NOT NULL DEFAULT 'all_retailers',
    "targetCity" TEXT,
    "channels" TEXT[] DEFAULT ARRAY['in_app']::TEXT[],
    "status" "BroadcastStatus" NOT NULL DEFAULT 'sent',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "authorName" TEXT NOT NULL DEFAULT 'Operations Lead',
    "authorStaffId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BroadcastMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BroadcastMessage_status_createdAt_idx" ON "BroadcastMessage"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BroadcastMessage_audience_createdAt_idx" ON "BroadcastMessage"("audience", "createdAt");
