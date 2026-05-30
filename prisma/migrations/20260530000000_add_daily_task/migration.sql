CREATE TABLE "DailyTask" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "date" TEXT NOT NULL,
  "rawInput" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "startAt" TEXT,
  "durationMinutes" INTEGER NOT NULL DEFAULT 30,
  "completedAt" DATETIME,
  "calendarEventId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "DailyTask_date_idx" ON "DailyTask"("date");
