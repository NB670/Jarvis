# Daily Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Today panel to the Notes app with a free-text task input that AI-parses into structured tasks, syncs to Apple Calendar "Jarvis", and lets Jarvis chat plan and edit the list via a `set_daily_tasks` tool.

**Architecture:** New `DailyTask` Prisma model stores tasks per date. Free-text input hits a parse endpoint (LLM extracts title/time/duration), creates the DB record, then fires `osascript` to write to Apple Calendar. Jarvis chat gains a `set_daily_tasks` tool that replaces today's tasks in bulk. The Notes app sidebar gains a "Today" nav item that renders a `TodayPanel` component.

**Tech Stack:** Prisma 6 + SQLite, Next.js 16 App Router, osascript (macOS), OpenAI-compatible LLM, Tiptap-free (plain React for this panel), Vitest, Tailwind CSS 4.

---

## File Map

### Create
- `prisma/migrations/20260530000000_add_daily_task/migration.sql` — DailyTask DDL
- `src/lib/db/tasks.ts` — CRUD for DailyTask
- `src/lib/calendar/applescript.ts` — osascript wrappers for Apple Calendar
- `src/app/api/tasks/route.ts` — GET (list for date), POST (parse + create)
- `src/app/api/tasks/[id]/route.ts` — PUT (complete), DELETE
- `src/app/api/tasks/bulk/route.ts` — PUT (replace day — used by Jarvis)
- `src/components/notes/TodayPanel.tsx` — Today UI
- `tests/lib/db/tasks.test.ts` — DB layer tests

### Modify
- `prisma/schema.prisma` — add DailyTask model
- `src/lib/db/index.ts` — export tasks functions
- `src/lib/llm/prompts.ts` — add `parseTaskPrompt`
- `src/lib/llm/client.ts` — extend `chat()` with optional extra tools + handler
- `src/lib/jarvis/chat-service.ts` — handle `set_daily_tasks` tool call
- `src/lib/jarvis/context-builder.ts` — include today's tasks in context
- `src/lib/llm/prompts.ts` — update system prompt to mention task capability
- `src/components/notes/NotesClient.tsx` — add `'today'` view
- `src/components/notes/NoteList.tsx` — add Today nav item
- `electron/main.js` — add DailyTask to `applyMigrations`

---

## Task 1: Schema — add DailyTask model

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260530000000_add_daily_task/migration.sql`
- Modify: `electron/main.js`

- [ ] **Step 1: Add DailyTask to `prisma/schema.prisma`**

Add this model at the end of the file:

```prisma
model DailyTask {
  id              String    @id @default(cuid())
  date            String
  rawInput        String
  title           String
  startAt         String?
  durationMinutes Int       @default(30)
  completedAt     DateTime?
  calendarEventId String?
  createdAt       DateTime  @default(now())

  @@index([date])
}
```

- [ ] **Step 2: Apply schema to dev database**

```bash
cd /Users/neelb/Documents/Jarvis && npx prisma db push 2>&1
```

Expected: `🚀  Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Apply schema to test database**

```bash
sqlite3 /Users/neelb/Documents/Jarvis/prisma/test.db "
CREATE TABLE IF NOT EXISTS \"DailyTask\" (
  \"id\" TEXT NOT NULL PRIMARY KEY,
  \"date\" TEXT NOT NULL,
  \"rawInput\" TEXT NOT NULL,
  \"title\" TEXT NOT NULL,
  \"startAt\" TEXT,
  \"durationMinutes\" INTEGER NOT NULL DEFAULT 30,
  \"completedAt\" DATETIME,
  \"calendarEventId\" TEXT,
  \"createdAt\" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS \"DailyTask_date_idx\" ON \"DailyTask\"(\"date\");
" && echo "done"
```

Expected: `done`

- [ ] **Step 4: Create migration file for production builds**

```bash
mkdir -p /Users/neelb/Documents/Jarvis/prisma/migrations/20260530000000_add_daily_task
```

Write this to `prisma/migrations/20260530000000_add_daily_task/migration.sql`:

```sql
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
```

- [ ] **Step 5: Add DailyTask migration to `electron/main.js` `applyMigrations`**

In `electron/main.js`, inside the `applyMigrations` function after the `deletedAt` migration block, add:

```js
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='DailyTask'").all()
    if (tables.length === 0) {
      db.exec(`
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
      `)
    }
```

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260530000000_add_daily_task/ electron/main.js
git commit -m "feat: add DailyTask schema and migration"
```

---

## Task 2: DB layer — tasks.ts

**Files:**
- Create: `src/lib/db/tasks.ts`
- Create: `tests/lib/db/tasks.test.ts`
- Modify: `src/lib/db/index.ts`

- [ ] **Step 1: Write failing tests in `tests/lib/db/tasks.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  createDailyTask,
  listDailyTasksForDate,
  updateDailyTask,
  deleteDailyTask,
  replaceDailyTasksForDate,
} from '@/lib/db/tasks'

beforeEach(async () => {
  await prisma.dailyTask.deleteMany()
})

describe('createDailyTask', () => {
  it('creates a task and returns it', async () => {
    const task = await createDailyTask({
      date: '2026-05-30',
      rawInput: 'gym 9am 1hr',
      title: 'Gym',
      startAt: '09:00',
      durationMinutes: 60,
    })
    expect(task.title).toBe('Gym')
    expect(task.date).toBe('2026-05-30')
    expect(task.startAt).toBe('09:00')
    expect(task.durationMinutes).toBe(60)
    expect(task.completedAt).toBeNull()
    expect(task.calendarEventId).toBeNull()
  })

  it('creates a task with no time', async () => {
    const task = await createDailyTask({
      date: '2026-05-30',
      rawInput: 'write journal',
      title: 'Write journal',
      startAt: null,
      durationMinutes: 30,
    })
    expect(task.startAt).toBeNull()
  })
})

describe('listDailyTasksForDate', () => {
  it('returns only tasks for the given date', async () => {
    await createDailyTask({ date: '2026-05-30', rawInput: 'a', title: 'A', startAt: null, durationMinutes: 30 })
    await createDailyTask({ date: '2026-05-31', rawInput: 'b', title: 'B', startAt: null, durationMinutes: 30 })
    const tasks = await listDailyTasksForDate('2026-05-30')
    expect(tasks).toHaveLength(1)
    expect(tasks[0].title).toBe('A')
  })

  it('returns tasks sorted by startAt ascending, nulls last', async () => {
    await createDailyTask({ date: '2026-05-30', rawInput: 'c', title: 'C', startAt: null, durationMinutes: 30 })
    await createDailyTask({ date: '2026-05-30', rawInput: 'a', title: 'A', startAt: '09:00', durationMinutes: 30 })
    await createDailyTask({ date: '2026-05-30', rawInput: 'b', title: 'B', startAt: '07:00', durationMinutes: 30 })
    const tasks = await listDailyTasksForDate('2026-05-30')
    expect(tasks[0].title).toBe('B')
    expect(tasks[1].title).toBe('A')
    expect(tasks[2].title).toBe('C')
  })
})

describe('updateDailyTask', () => {
  it('marks task as completed', async () => {
    const task = await createDailyTask({ date: '2026-05-30', rawInput: 'gym', title: 'Gym', startAt: null, durationMinutes: 30 })
    const now = new Date()
    const updated = await updateDailyTask(task.id, { completedAt: now })
    expect(updated.completedAt).not.toBeNull()
  })

  it('sets calendarEventId', async () => {
    const task = await createDailyTask({ date: '2026-05-30', rawInput: 'gym', title: 'Gym', startAt: null, durationMinutes: 30 })
    const updated = await updateDailyTask(task.id, { calendarEventId: 'abc-123' })
    expect(updated.calendarEventId).toBe('abc-123')
  })
})

describe('deleteDailyTask', () => {
  it('removes the task', async () => {
    const task = await createDailyTask({ date: '2026-05-30', rawInput: 'gym', title: 'Gym', startAt: null, durationMinutes: 30 })
    await deleteDailyTask(task.id)
    const tasks = await listDailyTasksForDate('2026-05-30')
    expect(tasks).toHaveLength(0)
  })
})

describe('replaceDailyTasksForDate', () => {
  it('replaces all tasks and returns new ones', async () => {
    await createDailyTask({ date: '2026-05-30', rawInput: 'old', title: 'Old', startAt: null, durationMinutes: 30 })
    const tasks = await replaceDailyTasksForDate('2026-05-30', [
      { rawInput: 'gym 9am', title: 'Gym', startAt: '09:00', durationMinutes: 60 },
      { rawInput: 'lunch', title: 'Lunch', startAt: '12:00', durationMinutes: 60 },
    ])
    expect(tasks).toHaveLength(2)
    const remaining = await listDailyTasksForDate('2026-05-30')
    expect(remaining).toHaveLength(2)
  })

  it('returns old tasks calendarEventIds for cleanup', async () => {
    const old = await createDailyTask({ date: '2026-05-30', rawInput: 'old', title: 'Old', startAt: null, durationMinutes: 30 })
    await updateDailyTask(old.id, { calendarEventId: 'cal-id-1' })
    const { deletedCalendarEventIds } = await replaceDailyTasksForDate('2026-05-30', [])
    expect(deletedCalendarEventIds).toContain('cal-id-1')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/neelb/Documents/Jarvis && npm test -- tests/lib/db/tasks.test.ts 2>&1 | tail -15
```

Expected: FAIL — `Cannot find module '@/lib/db/tasks'`

- [ ] **Step 3: Implement `src/lib/db/tasks.ts`**

```ts
import { prisma } from '@/lib/prisma'

interface CreateTaskInput {
  date: string
  rawInput: string
  title: string
  startAt: string | null
  durationMinutes: number
  calendarEventId?: string | null
}

export async function createDailyTask(input: CreateTaskInput) {
  return prisma.dailyTask.create({ data: input })
}

export async function listDailyTasksForDate(date: string) {
  const tasks = await prisma.dailyTask.findMany({ where: { date } })
  return tasks.sort((a, b) => {
    if (a.startAt === null && b.startAt === null) return 0
    if (a.startAt === null) return 1
    if (b.startAt === null) return -1
    return a.startAt.localeCompare(b.startAt)
  })
}

export async function updateDailyTask(
  id: string,
  data: Partial<{ completedAt: Date | null; calendarEventId: string | null }>,
) {
  return prisma.dailyTask.update({ where: { id }, data })
}

export async function deleteDailyTask(id: string) {
  return prisma.dailyTask.delete({ where: { id } })
}

export async function replaceDailyTasksForDate(
  date: string,
  tasks: Omit<CreateTaskInput, 'calendarEventId'>[],
): Promise<{ deletedCalendarEventIds: string[]; created: Awaited<ReturnType<typeof prisma.dailyTask.findMany>> }> {
  const existing = await prisma.dailyTask.findMany({ where: { date } })
  const deletedCalendarEventIds = existing
    .map((t) => t.calendarEventId)
    .filter((id): id is string => id !== null)

  await prisma.dailyTask.deleteMany({ where: { date } })

  const created = await Promise.all(tasks.map((t) => prisma.dailyTask.create({ data: { ...t, date } })))

  return { deletedCalendarEventIds, created }
}
```

- [ ] **Step 4: Export from `src/lib/db/index.ts`**

Add to the end of `src/lib/db/index.ts`:

```ts
export * from './tasks'
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- tests/lib/db/tasks.test.ts 2>&1 | tail -10
```

Expected: all 8 tests pass.

- [ ] **Step 6: Run full test suite**

```bash
npm test 2>&1 | tail -6
```

Expected: all 26 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/tasks.ts src/lib/db/index.ts tests/lib/db/tasks.test.ts
git commit -m "feat: DailyTask DB layer with tests"
```

---

## Task 3: Apple Calendar sync — applescript.ts

**Files:**
- Create: `src/lib/calendar/applescript.ts`

No unit tests (requires live Calendar.app). Manually verify in Task 4.

- [ ] **Step 1: Create `src/lib/calendar/applescript.ts`**

```ts
import { spawnSync } from 'child_process'

function runScript(script: string): string {
  const result = spawnSync('osascript', ['-e', script], { encoding: 'utf8' })
  if (result.error || result.status !== 0) return ''
  return (result.stdout ?? '').toString().trim()
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function createCalendarEvent(
  title: string,
  date: string,       // "YYYY-MM-DD"
  startAt: string | null,   // "HH:MM" 24h, or null for all-day
  durationMinutes: number,
): string | null {
  try {
    const [year, month, day] = date.split('-').map(Number)
    let script: string

    if (startAt) {
      const [hours, minutes] = startAt.split(':').map(Number)
      const timeSeconds = hours * 3600 + minutes * 60
      const endSeconds = timeSeconds + durationMinutes * 60
      script = `
tell application "Calendar"
  tell calendar "Jarvis"
    set startDate to current date
    set year of startDate to ${year}
    set month of startDate to ${month}
    set day of startDate to ${day}
    set time of startDate to ${timeSeconds}
    set endDate to current date
    set year of endDate to ${year}
    set month of endDate to ${month}
    set day of endDate to ${day}
    set time of endDate to ${endSeconds}
    set newEvent to make new event with properties {summary:"${esc(title)}", start date:startDate, end date:endDate}
    return uid of newEvent
  end tell
end tell`
    } else {
      script = `
tell application "Calendar"
  tell calendar "Jarvis"
    set startDate to current date
    set year of startDate to ${year}
    set month of startDate to ${month}
    set day of startDate to ${day}
    set time of startDate to 0
    set endDate to startDate + (${durationMinutes} * 60)
    set newEvent to make new event with properties {summary:"${esc(title)}", start date:startDate, end date:endDate, allday event:true}
    return uid of newEvent
  end tell
end tell`
    }

    const uid = runScript(script)
    return uid || null
  } catch {
    return null
  }
}

export function deleteCalendarEvent(uid: string): void {
  try {
    const script = `
tell application "Calendar"
  repeat with cal in calendars
    set evList to (every event of cal whose uid is "${esc(uid)}")
    repeat with ev in evList
      delete ev
    end repeat
  end repeat
end tell`
    runScript(script)
  } catch {
    // silently ignore — event may already be deleted
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/calendar/applescript.ts
git commit -m "feat: Apple Calendar osascript sync helpers"
```

---

## Task 4: Task parse prompt + GET/POST API

**Files:**
- Modify: `src/lib/llm/prompts.ts`
- Create: `src/app/api/tasks/route.ts`

- [ ] **Step 1: Add `parseTaskPrompt` to `src/lib/llm/prompts.ts`**

Add before the `jarvisMemoryUpdatePrompt` function:

```ts
export function parseTaskPrompt(rawInput: string, today: string, currentTime: string): string {
  return `Parse this task description into structured data. Return ONLY valid JSON, no markdown, no explanation.

Today is ${today}. Current time is ${currentTime}.

Input: "${rawInput}"

Return exactly: { "title": string, "startAt": string | null, "durationMinutes": number }

Rules:
- title: short, clean task name (e.g. "Gym", "Call dentist", "Deep work block")
- startAt: 24-hour "HH:MM" format, or null if no specific time is mentioned
- durationMinutes: integer minutes (default 30 if unclear; "1hr" = 60, "2 hours" = 120, "30 min" = 30)
- Resolve relative times: "morning" = "09:00", "after lunch" = "13:00", "afternoon" = "14:00", "evening" = "18:00", "tonight" = "19:00"
- Ignore filler words like "maybe", "try to", "should"

Examples:
  "gym 9am 1hr"        → { "title": "Gym", "startAt": "09:00", "durationMinutes": 60 }
  "call dentist"       → { "title": "Call dentist", "startAt": null, "durationMinutes": 30 }
  "deep work 2-4pm"    → { "title": "Deep work", "startAt": "14:00", "durationMinutes": 120 }
  "lunch with team"    → { "title": "Lunch with team", "startAt": "12:00", "durationMinutes": 60 }`
}
```

- [ ] **Step 2: Create `src/app/api/tasks/route.ts`**

```ts
import { createDailyTask, listDailyTasksForDate, updateDailyTask } from '@/lib/db'
import { createCalendarEvent } from '@/lib/calendar/applescript'
import { chatJson } from '@/lib/llm/client'
import { parseTaskPrompt } from '@/lib/llm/prompts'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date param required (YYYY-MM-DD)' }, { status: 400 })
  }
  const tasks = await listDailyTasksForDate(date)
  return NextResponse.json(tasks)
}

export async function POST(req: Request) {
  const body = (await req.json()) as { rawInput?: string; date?: string }
  if (typeof body.rawInput !== 'string' || !body.rawInput.trim()) {
    return NextResponse.json({ error: 'rawInput is required' }, { status: 400 })
  }
  if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return NextResponse.json({ error: 'date is required (YYYY-MM-DD)' }, { status: 400 })
  }

  const now = new Date()
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  let parsed: { title: string; startAt: string | null; durationMinutes: number }
  try {
    const raw = await chatJson([{ role: 'user', content: parseTaskPrompt(body.rawInput, body.date, currentTime) }])
    parsed = JSON.parse(raw)
  } catch {
    // Fall back: use raw input as title, no time
    parsed = { title: body.rawInput.trim(), startAt: null, durationMinutes: 30 }
  }

  const task = await createDailyTask({
    date: body.date,
    rawInput: body.rawInput,
    title: parsed.title,
    startAt: parsed.startAt,
    durationMinutes: parsed.durationMinutes,
  })

  const eventId = createCalendarEvent(task.title, task.date, task.startAt, task.durationMinutes)
  if (eventId) {
    await updateDailyTask(task.id, { calendarEventId: eventId })
    return NextResponse.json({ ...task, calendarEventId: eventId }, { status: 201 })
  }

  return NextResponse.json(task, { status: 201 })
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/neelb/Documents/Jarvis && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/llm/prompts.ts src/app/api/tasks/route.ts
git commit -m "feat: task parse prompt and GET/POST /api/tasks"
```

---

## Task 5: Task update and delete API

**Files:**
- Create: `src/app/api/tasks/[id]/route.ts`

- [ ] **Step 1: Create `src/app/api/tasks/[id]/route.ts`**

```ts
import { deleteDailyTask, updateDailyTask } from '@/lib/db'
import { deleteCalendarEvent } from '@/lib/calendar/applescript'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json()) as { completed?: boolean }

  try {
    if (body.completed === true) {
      const task = await updateDailyTask(id, { completedAt: new Date() })
      if (task.calendarEventId) deleteCalendarEvent(task.calendarEventId)
      return NextResponse.json(task)
    }
    if (body.completed === false) {
      const task = await updateDailyTask(id, { completedAt: null })
      return NextResponse.json(task)
    }
    return NextResponse.json({ error: 'completed boolean is required' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    // Need calendarEventId before deleting
    const { prisma } = await import('@/lib/prisma')
    const task = await prisma.dailyTask.findUnique({ where: { id } })
    if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (task.calendarEventId) deleteCalendarEvent(task.calendarEventId)
    await deleteDailyTask(id)
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tasks/\[id\]/route.ts
git commit -m "feat: PUT/DELETE /api/tasks/:id"
```

---

## Task 6: Bulk update API for Jarvis

**Files:**
- Create: `src/app/api/tasks/bulk/route.ts`

- [ ] **Step 1: Create `src/app/api/tasks/bulk/route.ts`**

```ts
import { replaceDailyTasksForDate, updateDailyTask } from '@/lib/db'
import { createCalendarEvent, deleteCalendarEvent } from '@/lib/calendar/applescript'
import { NextResponse } from 'next/server'

interface TaskInput {
  rawInput: string
  title: string
  startAt: string | null
  durationMinutes: number
}

export async function PUT(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date param required (YYYY-MM-DD)' }, { status: 400 })
  }

  const body = (await req.json()) as { tasks?: TaskInput[] }
  if (!Array.isArray(body.tasks)) {
    return NextResponse.json({ error: 'tasks array is required' }, { status: 400 })
  }

  const { deletedCalendarEventIds, created } = await replaceDailyTasksForDate(date, body.tasks)

  for (const uid of deletedCalendarEventIds) deleteCalendarEvent(uid)

  const withEvents = await Promise.all(
    created.map(async (task) => {
      const eventId = createCalendarEvent(task.title, task.date, task.startAt, task.durationMinutes)
      if (eventId) {
        await updateDailyTask(task.id, { calendarEventId: eventId })
        return { ...task, calendarEventId: eventId }
      }
      return task
    }),
  )

  return NextResponse.json(withEvents)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tasks/bulk/route.ts
git commit -m "feat: PUT /api/tasks/bulk — replace day tasks (used by Jarvis)"
```

---

## Task 7: Jarvis tool + context integration

**Files:**
- Modify: `src/lib/llm/client.ts`
- Modify: `src/lib/jarvis/chat-service.ts`
- Modify: `src/lib/jarvis/context-builder.ts`
- Modify: `src/lib/llm/prompts.ts`

- [ ] **Step 1: Extend `chat()` in `src/lib/llm/client.ts` to support extra tools**

Replace the `chat` function signature and implementation. Find the existing `export async function chat(messages: Message[]): Promise<string>` and replace it with:

```ts
export async function chat(
  messages: Message[],
  options: {
    extraTools?: object[]
    onExtraToolCall?: (name: string, args: unknown) => Promise<string>
  } = {},
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new LlmError('OPENAI_API_KEY is not set', 503)

  const base = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o'
  const tools = [WEB_SEARCH_TOOL, ...(options.extraTools ?? [])]

  const callLlm = async (msgs: Message[]) => {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, temperature: 0.6, messages: msgs, tools }),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new LlmError(`LLM request failed (${res.status}): ${err.slice(0, 800) || res.statusText}`, res.status)
    }

    return res.json() as Promise<{
      choices: Array<{
        message: {
          role: string
          content: string | null
          tool_calls?: ToolCall[]
        }
        finish_reason: string
      }>
    }>
  }

  let currentMessages = messages
  // Allow up to 5 tool call rounds to prevent infinite loops
  for (let i = 0; i < 5; i++) {
    const body = await callLlm(currentMessages)
    const choice = body.choices[0]

    if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls?.length) {
      const text = choice.message.content
      if (!text || typeof text !== 'string') throw new LlmError('Empty LLM response', 502)
      return text
    }

    const tc = choice.message.tool_calls[0]
    const toolName = tc.function.name
    const toolArgs = JSON.parse(tc.function.arguments) as unknown

    let toolResult: string
    if (toolName === 'web_search') {
      toolResult = await tavilySearch((toolArgs as { query: string }).query)
    } else if (options.onExtraToolCall) {
      toolResult = await options.onExtraToolCall(toolName, toolArgs)
    } else {
      toolResult = `Unknown tool: ${toolName}`
    }

    currentMessages = [
      ...currentMessages,
      { role: 'assistant', content: choice.message.content ?? '', tool_calls: choice.message.tool_calls },
      { role: 'tool', content: toolResult, tool_call_id: tc.id },
    ]
  }

  throw new LlmError('Too many tool call rounds', 502)
}
```

- [ ] **Step 2: Add `set_daily_tasks` tool + handler to `src/lib/jarvis/chat-service.ts`**

Replace the entire file:

```ts
import { appendChatMessages, replaceDailyTasksForDate, updateDailyTask } from '@/lib/db'
import { createCalendarEvent, deleteCalendarEvent } from '@/lib/calendar/applescript'
import { chat } from '@/lib/llm/client'
import { buildContext } from './context-builder'
import { updateMemoryAsync } from './memory-service'

const SET_DAILY_TASKS_TOOL = {
  type: 'function',
  function: {
    name: 'set_daily_tasks',
    description: "Replace the user's task list for a given day. Call this when the user asks to plan their day, schedule tasks, or update their task list.",
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              rawInput: { type: 'string', description: 'Natural language description of the task' },
              title: { type: 'string', description: 'Short, clean task title' },
              startAt: { type: 'string', nullable: true, description: '24-hour HH:MM format, or null if no specific time' },
              durationMinutes: { type: 'number', description: 'Duration in minutes' },
            },
            required: ['rawInput', 'title', 'durationMinutes'],
          },
        },
      },
      required: ['date', 'tasks'],
    },
  },
}

interface SetDailyTasksArgs {
  date: string
  tasks: Array<{
    rawInput: string
    title: string
    startAt: string | null
    durationMinutes: number
  }>
}

async function handleSetDailyTasks(args: SetDailyTasksArgs): Promise<string> {
  const { date, tasks } = args
  const { deletedCalendarEventIds, created } = await replaceDailyTasksForDate(date, tasks)

  for (const uid of deletedCalendarEventIds) deleteCalendarEvent(uid)

  await Promise.all(
    created.map(async (task) => {
      const eventId = createCalendarEvent(task.title, task.date, task.startAt, task.durationMinutes)
      if (eventId) await updateDailyTask(task.id, { calendarEventId: eventId })
    }),
  )

  return `Scheduled ${tasks.length} task${tasks.length !== 1 ? 's' : ''} for ${date} and synced to Apple Calendar.`
}

export async function runJarvisChat(userText: string) {
  const ctx = await buildContext([{ role: 'user', content: userText }])

  const reply = await chat(ctx.messages, {
    extraTools: [SET_DAILY_TASKS_TOOL],
    onExtraToolCall: async (name, args) => {
      if (name === 'set_daily_tasks') {
        return handleSetDailyTasks(args as SetDailyTasksArgs)
      }
      return `Unknown tool: ${name}`
    },
  })

  await appendChatMessages([
    { role: 'user', content: userText },
    { role: 'assistant', content: reply },
  ])

  updateMemoryAsync(ctx.memory, userText, reply)

  return { message: reply }
}
```

- [ ] **Step 3: Add today's tasks to `src/lib/jarvis/context-builder.ts`**

Replace the entire file:

```ts
import { getMemory, getRecentChatMessages, getUpcomingCalendarEvents, listDailyTasksForDate, listNotes } from '@/lib/db'
import { jarvisChatSystemPrompt } from '@/lib/llm/prompts'
import type { ChatMessage, JarvisMemoryData } from '@/lib/llm/types'
import type { DailyTask } from '@prisma/client'

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatMemory(
  mem: JarvisMemoryData,
  notes: { title: string; content: string }[],
  events: { title: string; startAt: Date }[],
  tasks: DailyTask[],
): string {
  const goalsBlock = mem.goals.length
    ? mem.goals
        .map(
          (g) =>
            `- [${g.horizon}/${g.priority ?? 'medium'}] ${g.title}${g.target ? ` — ${g.target}` : ''}${g.lastEngaged ? ` (last engaged: ${g.lastEngaged})` : ''}`,
        )
        .join('\n')
    : '(none)'

  const habitsBlock = mem.habits.length
    ? mem.habits
        .map(
          (h) =>
            `- ${h.title}${h.frequency ? ` (${h.frequency})` : ''}${h.lastMentioned ? `, last mentioned: ${h.lastMentioned}` : ''}`,
        )
        .join('\n')
    : '(none)'

  const notesBlock = notes.length
    ? notes
        .map((n) => {
          const plain = stripHtml(n.content).slice(0, 800)
          return `### ${n.title}\n${plain}${plain.length === 800 ? '…' : ''}`
        })
        .join('\n\n')
    : '(none)'

  const calendarBlock = events.length
    ? events
        .map((e) => `- ${e.startAt.toISOString().slice(0, 16).replace('T', ' ')}: ${e.title}`)
        .join('\n')
    : '(none)'

  const tasksBlock = tasks.length
    ? tasks
        .map(
          (t) =>
            `- ${t.startAt ?? 'no time'}: ${t.title} (${t.durationMinutes}min)${t.completedAt ? ' ✓' : ''}`,
        )
        .join('\n')
    : '(none scheduled)'

  return [
    'GOALS:',
    goalsBlock,
    '',
    'HABITS:',
    habitsBlock,
    '',
    'INTERESTS: ' + (mem.interests.join(', ') || '(none)'),
    '',
    'KEY FACTS: ' + (mem.keyFacts.join('; ') || '(none)'),
    '',
    'NOTES:',
    notesBlock,
    '',
    'UPCOMING CALENDAR (next 7 days):',
    calendarBlock,
    '',
    `TODAY'S TASKS (${todayDate()}):`,
    tasksBlock,
  ].join('\n')
}

export async function buildContext(extraMessages: ChatMessage[]) {
  const today = todayDate()
  const [mem, notes, recentChat, events, tasks] = await Promise.all([
    getMemory(),
    listNotes(),
    getRecentChatMessages(20),
    getUpcomingCalendarEvents(7),
    listDailyTasksForDate(today),
  ])

  const memoryText = formatMemory(mem, notes, events, tasks)
  const systemPrompt = `${jarvisChatSystemPrompt()}\n\nMEMORY_CONTEXT:\n${memoryText}`

  const historyMessages: ChatMessage[] = recentChat.map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }))

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    ...extraMessages,
  ]

  return { systemPrompt, memoryText, messages, memory: mem }
}
```

- [ ] **Step 4: Update system prompt in `src/lib/llm/prompts.ts`**

In `jarvisChatSystemPrompt`, replace the Capabilities section to add task management:

```ts
export function jarvisChatSystemPrompt(): string {
  return `You are Jarvis, a personal planning partner and life coach. You know the user deeply through their notes and memory.

Personality: Direct, thoughtful, practical. Never sycophantic. Bias toward the smallest actionable next step. Honest about what you don't know.

Capabilities:
- Hold full planning conversations — strategy, prioritisation, brainstorming
- Answer questions using web_search when current information is needed
- Create and update notes in the user's notes app
- Plan the user's day by scheduling tasks with set_daily_tasks (syncs to Apple Calendar "Jarvis")
- Update what you know about the user (goals, habits, patterns)

When you act on the user's data, describe what you did inline in your response (e.g. "I've added that to your Goals note." or "I've scheduled 4 tasks for today in your calendar.").

You have access to the user's notes, goals, habits, calendar, today's tasks, and memory context — use them.

Output: plain conversational text (you may use markdown bullets when listing things). Do NOT wrap your response in JSON.`
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 6: Run full test suite**

```bash
npm test 2>&1 | tail -6
```

Expected: all 26 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/llm/client.ts src/lib/jarvis/chat-service.ts src/lib/jarvis/context-builder.ts src/lib/llm/prompts.ts
git commit -m "feat: Jarvis set_daily_tasks tool and today tasks context"
```

---

## Task 8: Today UI

**Files:**
- Create: `src/components/notes/TodayPanel.tsx`
- Modify: `src/components/notes/NotesClient.tsx`
- Modify: `src/components/notes/NoteList.tsx`

- [ ] **Step 1: Create `src/components/notes/TodayPanel.tsx`**

```tsx
'use client'

import type { DailyTask } from '@prisma/client'
import { useCallback, useEffect, useRef, useState } from 'react'

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function TaskRow({
  task,
  onComplete,
  onDelete,
}: {
  task: DailyTask
  onComplete: (id: string, completed: boolean) => void
  onDelete: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800 group transition-colors ${
        task.completedAt ? 'opacity-50' : ''
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <input
        type="checkbox"
        checked={!!task.completedAt}
        onChange={(e) => onComplete(task.id, e.target.checked)}
        className="w-4 h-4 rounded accent-zinc-600 flex-shrink-0 cursor-pointer"
      />
      <div className="flex-1 min-w-0">
        <span
          className={`text-sm text-zinc-900 dark:text-zinc-100 ${
            task.completedAt ? 'line-through' : ''
          }`}
        >
          {task.title}
        </span>
        {task.startAt && (
          <span className="ml-2 text-xs text-zinc-400">
            {task.startAt} · {task.durationMinutes}min
          </span>
        )}
      </div>
      {hovered && (
        <button
          onClick={() => onDelete(task.id)}
          className="w-5 h-5 flex items-center justify-center text-zinc-300 hover:text-red-400 transition-colors flex-shrink-0"
          title="Delete task"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </div>
  )
}

export function TodayPanel() {
  const [tasks, setTasks] = useState<DailyTask[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const today = todayDate()
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchTasks = useCallback(async () => {
    const res = await fetch(`/api/tasks?date=${today}`)
    if (res.ok) setTasks(await res.json())
  }, [today])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const handleAdd = useCallback(async () => {
    const raw = input.trim()
    if (!raw) return
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput: raw, date: today }),
      })
      if (res.ok) {
        const task = (await res.json()) as DailyTask
        setTasks((prev) => {
          const next = [...prev, task]
          return next.sort((a, b) => {
            if (!a.startAt && !b.startAt) return 0
            if (!a.startAt) return 1
            if (!b.startAt) return -1
            return a.startAt.localeCompare(b.startAt)
          })
        })
      }
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [input, today])

  const handleComplete = useCallback(async (id: string, completed: boolean) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completedAt: completed ? new Date() : null } : t)),
    )
    await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    })
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
  }, [])

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-full">
      <div className="px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {formatDate(today)}
        </h1>
      </div>

      <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
            placeholder="Add a task… (e.g. "gym 9am 1hr")"
            disabled={loading}
            className="flex-1 text-sm bg-transparent border-none outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600"
          />
          {loading && (
            <span className="text-xs text-zinc-400">parsing…</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 && !loading && (
          <p className="px-6 py-8 text-sm text-zinc-400">
            No tasks yet. Type anything above to add one.
          </p>
        )}
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onComplete={handleComplete}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `src/components/notes/NotesClient.tsx` to add 'today' view**

Change the `view` state type and add the Today panel. Replace the entire file:

```tsx
'use client'

import type { Note } from '@prisma/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { NoteEditor } from './NoteEditor'
import { NoteList } from './NoteList'
import { TodayPanel } from './TodayPanel'

interface Props {
  initialNotes: Note[]
  initialDeletedNotes: Note[]
}

export function NotesClient({ initialNotes, initialDeletedNotes }: Props) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [deletedNotes, setDeletedNotes] = useState<Note[]>(initialDeletedNotes)
  const [selectedId, setSelectedId] = useState<string | null>(initialNotes[0]?.id ?? null)
  const [view, setView] = useState<'notes' | 'trash' | 'today'>('notes')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedNote = notes.find((n) => n.id === selectedId) ?? null

  const handleNew = useCallback(async () => {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '' }),
    })
    const note = (await res.json()) as Note
    setNotes((prev) => [note, ...prev])
    setSelectedId(note.id)
    setView('notes')
  }, [])

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
  }, [])

  const handleChange = useCallback(
    (html: string) => {
      if (!selectedId) return
      setNotes((prev) =>
        prev.map((n) => (n.id === selectedId ? { ...n, content: html } : n)),
      )
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        await fetch(`/api/notes/${selectedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: html }),
        })
        const res = await fetch('/api/notes')
        const updated = (await res.json()) as Note[]
        setNotes(updated)
      }, 800)
    },
    [selectedId],
  )

  const handleDelete = useCallback(async (id: string) => {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    setNotes((prev) => prev.filter((n) => n.id !== id))
    const res = await fetch('/api/notes?deleted=true')
    setDeletedNotes(await res.json())
    setSelectedId((prev) => (prev === id ? null : prev))
  }, [])

  const handleRestore = useCallback(async (id: string) => {
    const res = await fetch(`/api/notes/${id}/restore`, { method: 'POST' })
    const restored = (await res.json()) as Note
    setDeletedNotes((prev) => prev.filter((n) => n.id !== id))
    setNotes((prev) => [restored, ...prev])
  }, [])

  const handlePermanentDelete = useCallback(async (id: string) => {
    await fetch(`/api/notes/${id}?permanent=true`, { method: 'DELETE' })
    setDeletedNotes((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const handlePermanentDeleteAll = useCallback(async () => {
    await Promise.all(
      deletedNotes.map((n) => fetch(`/api/notes/${n.id}?permanent=true`, { method: 'DELETE' })),
    )
    setDeletedNotes([])
  }, [deletedNotes])

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950">
      <NoteList
        notes={notes}
        deletedNotes={deletedNotes}
        selectedId={selectedId}
        view={view}
        onSelect={handleSelect}
        onNew={handleNew}
        onDelete={handleDelete}
        onRestore={handleRestore}
        onPermanentDelete={handlePermanentDelete}
        onPermanentDeleteAll={handlePermanentDeleteAll}
        onViewChange={setView}
      />
      <div className="flex-1 overflow-hidden flex flex-col">
        {view === 'today' ? (
          <TodayPanel />
        ) : view === 'trash' ? (
          <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">
            Recently deleted notes are shown in the sidebar
          </div>
        ) : selectedNote ? (
          <NoteEditor
            key={selectedNote.id}
            content={selectedNote.content}
            onChange={handleChange}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">
            Select a note or create a new one
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update `src/components/notes/NoteList.tsx` to add Today nav item**

Update the Props interface to accept `view: 'notes' | 'trash' | 'today'` and `onViewChange: (view: 'notes' | 'trash' | 'today') => void`. Add a Today button above the notes list header. Replace the entire file:

```tsx
'use client'

import type { Note } from '@prisma/client'
import { useState } from 'react'

interface Props {
  notes: Note[]
  deletedNotes: Note[]
  selectedId: string | null
  view: 'notes' | 'trash' | 'today'
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
  onPermanentDelete: (id: string) => void
  onPermanentDeleteAll: () => void
  onViewChange: (view: 'notes' | 'trash' | 'today') => void
}

function preview(content: string) {
  const lines = content.split('\n').filter((l) => l.trim())
  return lines.slice(1, 3).join(' ').replace(/^#+\s*/, '').slice(0, 80) || 'No additional text'
}

function NoteRow({
  note,
  selected,
  onSelect,
  onDelete,
}: {
  note: Note
  selected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={`relative w-full border-b border-zinc-100 dark:border-zinc-800 transition-colors ${
        selected ? 'bg-zinc-200 dark:bg-zinc-700' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button onClick={onSelect} className="w-full text-left px-4 py-3 pr-8">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
          {note.title || 'Untitled'}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
          {preview(note.content)}
        </p>
      </button>
      {hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
          title="Delete note"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </div>
  )
}

function DeletedNoteRow({
  note,
  onRestore,
  onPermanentDelete,
}: {
  note: Note
  onRestore: () => void
  onPermanentDelete: () => void
}) {
  return (
    <div className="w-full px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">
        {note.title || 'Untitled'}
      </p>
      <div className="flex items-center gap-2 mt-0.5">
        <button onClick={onRestore} className="text-xs text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
          Restore
        </button>
        <span className="text-zinc-300 dark:text-zinc-600 text-xs">·</span>
        <button onClick={onPermanentDelete} className="text-xs text-zinc-400 hover:text-red-500 transition-colors">
          Delete
        </button>
      </div>
    </div>
  )
}

export function NoteList({
  notes,
  deletedNotes,
  selectedId,
  view,
  onSelect,
  onNew,
  onDelete,
  onRestore,
  onPermanentDelete,
  onPermanentDeleteAll,
  onViewChange,
}: Props) {
  const todayLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className="flex flex-col h-full w-64 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex-shrink-0">
      {/* Today nav */}
      <button
        onClick={() => onViewChange('today')}
        className={`flex items-center justify-between px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 transition-colors ${
          view === 'today'
            ? 'bg-zinc-200 dark:bg-zinc-700'
            : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
        }`}
      >
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Today</span>
        <span className="text-xs text-zinc-400">{todayLabel}</span>
      </button>

      {/* Notes header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          {view === 'trash' ? 'Recently Deleted' : 'Notes'}
        </span>
        <div className="flex items-center gap-2">
          {view === 'trash' ? (
            <button
              onClick={() => onViewChange('notes')}
              className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              Done
            </button>
          ) : view === 'notes' ? (
            <button
              onClick={onNew}
              className="text-xl leading-none text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              aria-label="New note"
            >
              +
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {(view === 'notes' || view === 'today') && (
          <>
            {notes.length === 0 && (
              <p className="px-4 py-6 text-sm text-zinc-400">No notes yet. Hit + to create one.</p>
            )}
            {notes.map((note) => (
              <NoteRow
                key={note.id}
                note={note}
                selected={note.id === selectedId && view === 'notes'}
                onSelect={() => { onViewChange('notes'); onSelect(note.id) }}
                onDelete={() => onDelete(note.id)}
              />
            ))}
          </>
        )}
        {view === 'trash' && (
          <>
            {deletedNotes.length === 0 && (
              <p className="px-4 py-6 text-sm text-zinc-400">No recently deleted notes.</p>
            )}
            {deletedNotes.map((note) => (
              <DeletedNoteRow
                key={note.id}
                note={note}
                onRestore={() => onRestore(note.id)}
                onPermanentDelete={() => onPermanentDelete(note.id)}
              />
            ))}
          </>
        )}
      </div>

      {view !== 'trash' && deletedNotes.length > 0 && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-2">
          <button
            onClick={() => onViewChange('trash')}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            Recently Deleted ({deletedNotes.length})
          </button>
        </div>
      )}

      {view === 'trash' && deletedNotes.length > 0 && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-2">
          <button
            onClick={onPermanentDeleteAll}
            className="text-xs text-red-400 hover:text-red-500 transition-colors"
          >
            Delete All
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 5: Run full test suite**

```bash
npm test 2>&1 | tail -6
```

Expected: all 26 tests pass.

- [ ] **Step 6: Manual smoke test in dev mode**

```bash
npm run electron:dev
```

Verify:
1. "Today" button appears at the top of the sidebar with today's date (e.g. "May 30")
2. Clicking it shows the Today panel with a text input
3. Typing "gym 9am 1hr" and pressing Enter shows "parsing…" then adds a task row: `[ ] 09:00 · Gym · 60min`
4. Checking the checkbox strikes through the task
5. × button on hover deletes the task
6. Existing notes list still works normally

- [ ] **Step 7: Commit**

```bash
git add src/components/notes/TodayPanel.tsx src/components/notes/NotesClient.tsx src/components/notes/NoteList.tsx
git commit -m "feat: Today panel UI — task input, task list, Today nav in sidebar"
```

---

## Final: build and install

- [ ] **Build and install**

First create the "Jarvis" calendar in Apple Calendar.app manually (Calendar → File → New Calendar → name it "Jarvis").

Then:

```bash
npm run electron:build && cp -r dist/mac-arm64/Notes.app /Applications/Notes.app
```

Expected: build succeeds, app installs, "Today" nav item visible in sidebar.
