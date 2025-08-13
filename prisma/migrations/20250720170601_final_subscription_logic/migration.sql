/*
  Warnings:

  - You are about to drop the column `assistantLimit` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `chatCreditBalance` on the `User` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "plan" TEXT,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'inactive',
    "subscriptionEndsAt" DATETIME,
    "basePlanLimit" INTEGER NOT NULL DEFAULT 0,
    "addOnSlots" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_User" ("createdAt", "email", "id", "imageUrl", "name", "passwordHash", "plan", "stripeCustomerId", "stripeSubscriptionId", "subscriptionStatus") SELECT "createdAt", "email", "id", "imageUrl", "name", "passwordHash", "plan", "stripeCustomerId", "stripeSubscriptionId", "subscriptionStatus" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
CREATE UNIQUE INDEX "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
