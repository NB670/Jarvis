# Daily Tasks — Design Spec

**Goal:** A simple daily task list with AI-powered free-text parsing, Apple Calendar sync to a dedicated "Jarvis" calendar, and bidirectional Jarvis chat integration for planning conversations.

---

## Architecture

### Data model

New `DailyTask` table in Prisma:

```prisma
model DailyTask {
  id              String    @id @default(cuid())
  date            String    // "YYYY-MM-DD" — which day this task belongs to
  rawInput        String    // exactly what the user typed
  title           String    // AI-parsed
  startAt         String?   // "HH:MM" 24-hour, AI-parsed, nullable if no time given
  durationMinutes Int       @default(30)
  completedAt     DateTime?
  calendarEventId String?   // Apple Calendar event ID for sync
  createdAt       DateTime  @default(now())

  @@index([date])
}
```

### AI parsing

When a user submits free-text input (e.g. "gym 9am 1hr", "call dentist for 30 mins around 2", "deep work block after lunch"), a server-side LLM call extracts:

```ts
{ title: string, startAt: string | null, durationMinutes: number }
```

The LLM receives today's date and current time as context so relative expressions ("after lunch", "this afternoon") resolve correctly. If no time can be inferred, `startAt` is null — the task still appears in the list and calendar without a specific time.

### Apple Calendar sync

All calendar operations use `osascript` (AppleScript) via Node `child_process`. Target calendar: a calendar named **"Jarvis"** in Calendar.app — the user creates this once manually.

| Event | Action |
|-------|--------|
| Task created | Create event in "Jarvis" calendar; store returned event ID in `calendarEventId` |
| Task completed | Delete the calendar event |
| Task deleted | Delete the calendar event |
| Task has no time | Create an all-day event |

### API routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tasks?date=YYYY-MM-DD` | List tasks for a date |
| POST | `/api/tasks` | Parse free text + create task |
| PUT | `/api/tasks/:id` | Update (complete, edit) |
| DELETE | `/api/tasks/:id` | Delete task + remove calendar event |
| PUT | `/api/tasks/bulk?date=YYYY-MM-DD` | Replace entire day's task list (used by Jarvis tool) |

### Jarvis tool: `set_daily_tasks`

Added to the Jarvis chat tool surface. Jarvis calls this to replace today's task list with a proposed schedule. Input:

```ts
{
  date: string,           // "YYYY-MM-DD"
  tasks: Array<{
    rawInput: string,     // natural language description
    title: string,        // parsed title
    startAt: string|null, // "HH:MM" or null
    durationMinutes: number
  }>
}
```

The tool deletes all existing tasks for that date, creates the new ones, and syncs all to Apple Calendar. Jarvis calls this iteratively as the user refines the plan in chat.

---

## UI

### Today panel in Notes app

A third nav item in the Notes sidebar, below the notes list. Clicking it replaces the sidebar content with the Today view and shows the task list in the main panel.

**Sidebar item:** "Today" with today's date (e.g. "May 30")

**Main panel:**
- Header: full date ("Friday, May 30")
- Free-text input at top with placeholder "Add a task…" — Enter to submit, AI parses it
- While parsing: brief loading state on the input
- Task list below:
  - Each row: `[ ] 9:00 AM · Gym · 1 hr` + × delete button on hover
  - Completed tasks: struck through, dimmed
  - Tasks without a time: shown at top of list with no time badge
- Empty state: "No tasks yet. Type anything to add one."
- No date navigation — always shows today. Past tasks are not visible.

---

## Jarvis chat integration

No UI changes to the Jarvis chat page. Jarvis gains awareness of today's tasks via context (passed in the system prompt alongside goals/memory) and gains the `set_daily_tasks` tool.

**Typical planning flow:**
1. User: "Help me plan my day"
2. Jarvis reads memory (goals, habits) + today's existing tasks
3. Jarvis asks what the user wants to prioritize
4. Jarvis proposes a schedule, calls `set_daily_tasks`
5. User iterates ("move gym to 7am") → Jarvis calls `set_daily_tasks` again with updated list
6. Today panel in Notes reflects the final list in real time (next load/refresh)

---

## Out of scope

- Reading back events from Apple Calendar (write-only sync)
- Multi-day planning or task carry-over
- Recurring tasks
- Drag-to-reorder
- Push notifications or reminders
