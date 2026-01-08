-- Initial schema for Nextdoor leads

CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'WON', 'LOST', 'IGNORED');
CREATE TYPE "LeadCategory" AS ENUM ('LANDSCAPING', 'INSTALL', 'UNKNOWN');
CREATE TYPE "NotificationChannel" AS ENUM ('SMS', 'EMAIL');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Lead" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "postUrl" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "snippet" TEXT NOT NULL,
  "rawSender" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "city" TEXT,
  "category" "LeadCategory" NOT NULL DEFAULT 'UNKNOWN',
  "score" INTEGER NOT NULL,
  "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
  "rawBody" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Lead_postUrl_key" ON "Lead"("postUrl");
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");
CREATE INDEX "Lead_city_idx" ON "Lead"("city");
CREATE INDEX "Lead_category_idx" ON "Lead"("category");

CREATE TABLE "Settings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "keywordConfig" JSONB NOT NULL,
  "cityList" JSONB NOT NULL,
  "threshold" INTEGER NOT NULL,
  "pollIntervalMinutes" INTEGER NOT NULL,
  "rateLimitPerHour" INTEGER NOT NULL,
  "storeRawEmail" BOOLEAN NOT NULL DEFAULT FALSE,
  "smsTargets" JSONB NOT NULL,
  "emailTargets" JSONB NOT NULL,
  "lastImapUid" INTEGER,
  "lastGmailQueryAfter" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationLog" (
  "id" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "postUrl" TEXT NOT NULL,
  "leadId" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "NotificationLog_sentAt_idx" ON "NotificationLog"("sentAt");
CREATE INDEX "NotificationLog_postUrl_idx" ON "NotificationLog"("postUrl");
