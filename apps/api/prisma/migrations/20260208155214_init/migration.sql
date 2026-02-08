/*
  Warnings:

  - You are about to drop the column `title` on the `Activity` table. All the data in the column will be lost.
  - You are about to drop the column `targetValue` on the `Goal` table. All the data in the column will be lost.
  - Added the required column `name` to the `Activity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Activity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `targetAmount` to the `Goal` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Session" ADD COLUMN "twilioCallSid" TEXT;

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "remindAt" DATETIME NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "isSent" BOOLEAN NOT NULL DEFAULT false
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "goalId" TEXT,
    "name" TEXT NOT NULL,
    "datetimeLocal" DATETIME NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "recurrenceRule" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "calendarEventId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Activity_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Activity" ("calendarEventId", "createdAt", "datetimeLocal", "durationMin", "goalId", "id", "recurrenceRule", "sessionId", "status", "userId") SELECT "calendarEventId", "createdAt", "datetimeLocal", "durationMin", "goalId", "id", "recurrenceRule", "sessionId", "status", "userId" FROM "Activity";
DROP TABLE "Activity";
ALTER TABLE "new_Activity" RENAME TO "Activity";
CREATE INDEX "Activity_userId_datetimeLocal_idx" ON "Activity"("userId", "datetimeLocal");
CREATE INDEX "Activity_userId_status_idx" ON "Activity"("userId", "status");
CREATE TABLE "new_Budget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "limitAmount" REAL NOT NULL,
    "remainingAmount" REAL NOT NULL DEFAULT 0,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Budget" ("category", "id", "limitAmount", "period", "remainingAmount", "startDate", "userId") SELECT "category", "id", "limitAmount", "period", "remainingAmount", "startDate", "userId" FROM "Budget";
DROP TABLE "Budget";
ALTER TABLE "new_Budget" RENAME TO "Budget";
CREATE INDEX "Budget_userId_idx" ON "Budget"("userId");
CREATE TABLE "new_Goal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metric" TEXT,
    "targetAmount" REAL NOT NULL,
    "targetDate" DATETIME,
    "frequency" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "streakCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT,
    CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Goal" ("createdAt", "frequency", "id", "metric", "streakCount", "title", "userId") SELECT "createdAt", "frequency", "id", "metric", "streakCount", "title", "userId" FROM "Goal";
DROP TABLE "Goal";
ALTER TABLE "new_Goal" RENAME TO "Goal";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
