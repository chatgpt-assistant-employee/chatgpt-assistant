-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "gmailMessageId" TEXT,
    "recipientEmail" TEXT,
    "assistantId" TEXT NOT NULL,
    CONSTRAINT "EmailLog_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "Assistant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EmailLog" ("action", "assistantId", "createdAt", "id") SELECT "action", "assistantId", "createdAt", "id" FROM "EmailLog";
DROP TABLE "EmailLog";
ALTER TABLE "new_EmailLog" RENAME TO "EmailLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
