-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChatThread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "openaiThreadId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assistantId" TEXT NOT NULL,
    CONSTRAINT "ChatThread_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "Assistant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ChatThread" ("assistantId", "createdAt", "id", "openaiThreadId", "title") SELECT "assistantId", "createdAt", "id", "openaiThreadId", "title" FROM "ChatThread";
DROP TABLE "ChatThread";
ALTER TABLE "new_ChatThread" RENAME TO "ChatThread";
CREATE UNIQUE INDEX "ChatThread_openaiThreadId_key" ON "ChatThread"("openaiThreadId");
CREATE TABLE "new_EmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "assistantId" TEXT NOT NULL,
    CONSTRAINT "EmailLog_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "Assistant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EmailLog" ("action", "assistantId", "createdAt", "id") SELECT "action", "assistantId", "createdAt", "id" FROM "EmailLog";
DROP TABLE "EmailLog";
ALTER TABLE "new_EmailLog" RENAME TO "EmailLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
