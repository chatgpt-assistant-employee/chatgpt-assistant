/*
  Warnings:

  - You are about to drop the column `googleTokens` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `openaiAssistantId` on the `User` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "Assistant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "openaiAssistantId" TEXT NOT NULL,
    "googleTokens" JSONB,
    CONSTRAINT "Assistant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'inactive',
    "stripeCustomerId" TEXT
);
INSERT INTO "new_User" ("createdAt", "email", "id", "passwordHash", "stripeCustomerId", "subscriptionStatus") SELECT "createdAt", "email", "id", "passwordHash", "stripeCustomerId", "subscriptionStatus" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Assistant_openaiAssistantId_key" ON "Assistant"("openaiAssistantId");
