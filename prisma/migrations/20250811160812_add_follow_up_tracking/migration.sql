-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT true,
    "followUpSent" BOOLEAN NOT NULL DEFAULT false,
    "threadId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "clickToken" TEXT,
    "gmailMessageId" TEXT,
    "postmarkMessageId" TEXT,
    "recipientEmail" TEXT,
    "openedAt" DATETIME,
    "clickedAt" DATETIME,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "assistantId" TEXT NOT NULL,
    CONSTRAINT "EmailLog_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "Assistant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EmailLog" ("action", "assistantId", "clickToken", "clickedAt", "createdAt", "gmailMessageId", "id", "ipAddress", "openedAt", "postmarkMessageId", "recipientEmail", "status", "threadId", "userAgent") SELECT "action", "assistantId", "clickToken", "clickedAt", "createdAt", "gmailMessageId", "id", "ipAddress", "openedAt", "postmarkMessageId", "recipientEmail", "status", "threadId", "userAgent" FROM "EmailLog";
DROP TABLE "EmailLog";
ALTER TABLE "new_EmailLog" RENAME TO "EmailLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
