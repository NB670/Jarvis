# Today UI Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "block" vs "to-do" task type toggle to the Today panel, and show a completable list of today's reminders (due today or overdue) below the task list.

**Architecture:** `DailyTask` gains a `type` field (`"block"` | `"todo"`). Block tasks sync to Apple Calendar (current behavior); todo tasks are UI-only checklist items with no time required. The Today panel gains a Reminders section that fetches incomplete reminders due by end of today and lets the user tick them off, which calls the existing `PUT /api/reminders/[id]` API to mark them done in Apple Reminders.

**Tech Stack:** Prisma 6 + SQLite, Next.js 16 API routes, React state, Tailwind CSS

---

## File Map

| Action | File | What changes |
|---|---|---|
| Modify | `prisma/schema.prisma` | Add `type String @default("block")` to DailyTask |
| Modify | `electron/main.js` | Add `type` column migration in `applyMigrations` |
| Modify | `src/lib/db/tasks.ts` | Add `type` to `CreateTaskInput`; widen `updateDailyTask` param |
| Modify | `src/lib/db/reminders.ts` | Add `listRemindersForToday()` |
| Modify | `src/app/api/tasks/route.ts` | Accept `type` in POST; skip calendar sync for todo |
| Modify | `src/app/api/tasks/[id]/route.ts` | Skip calendar ops for todo; accept `type` in field edits |
| Modify | `src/app/api/reminders/route.ts` | Add `?today=1` param |
| Create | `tests/api/tasks.test.ts` | Tests for type-aware calendar sync |
| Create | `tests/api/reminders.test.ts` | Tests for `?today=1` filter |
| Modify | `src/components/notes/TodayPanel.tsx` | Type toggle; conditional rendering; reminders section |

---

### Task 1: Schema, migration, and DB layer

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `electron/main.js`
- Modify: `src/lib/db/tasks.ts`
- Modify: `src/lib/db/reminders.ts`

- [ ] **Step 1: Add `type` to DailyTask in schema**

In `prisma/schema.prisma`, update the DailyTask model to add `type` after `rawInput`:

```prisma
model DailyTask {
  id              String    @id @default(cuid())
  date            String
  rawInput        String
  title           String
  type            String    @default("block")
  startAt         String?
  durationMinutes Int       @default(30)
  completedAt     DateTime?
  calendarEventId String?
  createdAt       DateTime  @default(now())

  @@index([date])
}
```

- [ ] **Step 2: Push schema to dev DB and regenerate client**

```bash
npx prisma db push && npx prisma generate
```

Expected: "Your database is now in sync" then "Prisma Client generated".

- [ ] **Step 3: Add migration to electron/main.js**

In `electron/main.js`, replace the `applyMigrations` function body with the version that adds the `type` column migration. The full updated function:

```js
function applyMigrations(dbPath) {
  const { DatabaseSync } = require('node:sqlite')
  const db = new DatabaseSync(dbPath)
  try {
    const cols = db.prepare('PRAGMA table_info(Note)').all()
    if (!cols.find((c) => c.name === 'deletedAt')) {
      db.exec('ALTER TABLE "Note" ADD COLUMN "deletedAt" DATETIME')
      db.exec('CREATE INDEX IF NOT EXISTS "Note_deletedAt_idx" ON "Note"("deletedAt")')
    }

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='DailyTask'").all()
    if (tables.length === 0) {
      db.exec(`
        CREATE TABLE "DailyTask" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "date" TEXT NOT NULL,
          "rawInput" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "type" TEXT NOT NULL DEFAULT 'block',
          "startAt" TEXT,
          "durationMinutes" INTEGER NOT NULL DEFAULT 30,
          "completedAt" DATETIME,
          "calendarEventId" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX "DailyTask_date_idx" ON "DailyTask"("date");
      `)
    } else {
      const taskCols = db.prepare('PRAGMA table_info(DailyTask)').all()
      if (!taskCols.find((c) => c.name === 'type')) {
        db.exec(`ALTER TABLE "DailyTask" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'block'`)
      }
    }
  } catch (e) {
    console.error('Migration error:', e)
    throw e
  } finally {
    db.close()
  }
}
```

- [ ] **Step 4: Update src/lib/db/tasks.ts**

Replace the entire file:

```ts
import type { DailyTask } from '@prisma/client'
import { prisma } from '@/lib/prisma'

interface CreateTaskInput {
  date: string
  rawInput: string
  title: string
  type: string
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
  data: Partial<{
    completedAt: Date | null
    calendarEventId: string | null
    title: string
    startAt: string | null
    durationMinutes: number
    type: string
  }>,
) {
  return prisma.dailyTask.update({ where: { id }, data })
}

export async function deleteDailyTask(id: string) {
  return prisma.dailyTask.delete({ where: { id } })
}

export async function replaceDailyTasksForDate(
  date: string,
  tasks: Omit<CreateTaskInput, 'calendarEventId' | 'date'>[],
): Promise<{ deletedCalendarEventIds: string[]; created: DailyTask[] }> {
  const existing = await prisma.dailyTask.findMany({ where: { date } })
  const deletedCalendarEventIds = existing
    .map((t) => t.calendarEventId)
    .filter((id): id is string => id !== null)

  const created = await prisma.$transaction(async (tx) => {
    await tx.dailyTask.deleteMany({ where: { date } })
    return Promise.all(tasks.map((t) => tx.dailyTask.create({ data: { ...t, date } })))
  })

  return { deletedCalendarEventIds, created }
}
```

- [ ] **Step 5: Add listRemindersForToday to src/lib/db/reminders.ts**

Append to the end of `src/lib/db/reminders.ts`:

```ts
export async function listRemindersForToday() {
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)
  return prisma.reminder.findMany({
    where: {
      completedAt: null,
      dueAt: { lte: endOfToday },
    },
    orderBy: { dueAt: 'asc' },
  })
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma electron/main.js src/lib/db/tasks.ts src/lib/db/reminders.ts
git commit -m "feat: add type field to DailyTask, listRemindersForToday DB function"
```

---

### Task 2: Update tasks API for type field

**Files:**
- Modify: `src/app/api/tasks/route.ts`
- Modify: `src/app/api/tasks/[id]/route.ts`
- Create: `tests/api/tasks.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/api/tasks.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateDailyTask = vi.fn()
const mockUpdateDailyTask = vi.fn()
const mockListDailyTasksForDate = vi.fn()
const mockCreateCalendarEvent = vi.fn()
const mockChatJson = vi.fn()

vi.mock('@/lib/db', () => ({
  createDailyTask: mockCreateDailyTask,
  updateDailyTask: mockUpdateDailyTask,
  listDailyTasksForDate: mockListDailyTasksForDate,
}))

vi.mock('@/lib/macos', () => ({
  createCalendarEvent: mockCreateCalendarEvent,
}))

vi.mock('@/lib/llm/client', () => ({
  chatJson: mockChatJson,
}))

vi.mock('@/lib/llm/prompts', () => ({
  parseTaskPrompt: vi.fn().mockReturnValue('parse prompt'),
}))

const baseTask = {
  id: 't1',
  title: 'Test task',
  date: '2026-06-01',
  rawInput: 'test',
  completedAt: null,
  calendarEventId: null,
  startAt: '09:00',
  durationMinutes: 60,
  createdAt: new Date(),
}

describe('POST /api/tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockChatJson.mockResolvedValue(JSON.stringify({ title: 'Test task', startAt: '09:00', durationMinutes: 60 }))
    mockCreateCalendarEvent.mockReturnValue('cal-1')
    mockUpdateDailyTask.mockResolvedValue({ ...baseTask, type: 'block', calendarEventId: 'cal-1' })
  })

  it('creates a calendar event for a block task', async () => {
    mockCreateDailyTask.mockResolvedValue({ ...baseTask, type: 'block' })
    const { POST } = await import('@/app/api/tasks/route')
    const req = new Request('http://localhost/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawInput: 'test', date: '2026-06-01', type: 'block' }),
    })
    await POST(req)
    expect(mockCreateCalendarEvent).toHaveBeenCalledOnce()
  })

  it('skips calendar event for a todo task', async () => {
    mockCreateDailyTask.mockResolvedValue({ ...baseTask, type: 'todo', startAt: null })
    const { POST } = await import('@/app/api/tasks/route')
    const req = new Request('http://localhost/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawInput: 'test', date: '2026-06-01', type: 'todo' }),
    })
    await POST(req)
    expect(mockCreateCalendarEvent).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run tests/api/tasks.test.ts
```

Expected: FAIL (the route doesn't handle `type` yet)

- [ ] **Step 3: Replace src/app/api/tasks/route.ts**

```ts
import { createDailyTask, listDailyTasksForDate, updateDailyTask } from '@/lib/db'
import { createCalendarEvent } from '@/lib/macos'
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
  const body = (await req.json()) as { rawInput?: string; date?: string; type?: string }
  if (typeof body.rawInput !== 'string' || !body.rawInput.trim()) {
    return NextResponse.json({ error: 'rawInput is required' }, { status: 400 })
  }
  if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return NextResponse.json({ error: 'date is required (YYYY-MM-DD)' }, { status: 400 })
  }

  const taskType = body.type === 'todo' ? 'todo' : 'block'

  const now = new Date()
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  let parsed: { title: string; startAt: string | null; durationMinutes: number }
  try {
    const raw = await chatJson([{ role: 'user', content: parseTaskPrompt(body.rawInput, body.date, currentTime) }])
    parsed = JSON.parse(raw)
  } catch {
    parsed = { title: body.rawInput.trim(), startAt: null, durationMinutes: 30 }
  }

  if (taskType === 'todo') parsed.startAt = null

  const task = await createDailyTask({
    date: body.date,
    rawInput: body.rawInput,
    title: parsed.title,
    type: taskType,
    startAt: parsed.startAt,
    durationMinutes: parsed.durationMinutes,
  })

  if (taskType === 'block') {
    const eventId = createCalendarEvent(task.title, task.date, task.startAt, task.durationMinutes)
    if (eventId) {
      await updateDailyTask(task.id, { calendarEventId: eventId })
      return NextResponse.json({ ...task, calendarEventId: eventId }, { status: 201 })
    }
  }

  return NextResponse.json(task, { status: 201 })
}
```

- [ ] **Step 4: Replace src/app/api/tasks/[id]/route.ts**

```ts
import { deleteDailyTask, updateDailyTask } from '@/lib/db'
import { createCalendarEvent, deleteCalendarEvent } from '@/lib/macos'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json()) as {
    completed?: boolean
    title?: string
    startAt?: string | null
    durationMinutes?: number
    type?: string
  }

  try {
    if (body.completed === true) {
      const existing = await prisma.dailyTask.findUnique({ where: { id } })
      const task = await updateDailyTask(id, { completedAt: new Date(), calendarEventId: null })
      if (existing?.calendarEventId) deleteCalendarEvent(existing.calendarEventId)
      return NextResponse.json(task)
    }
    if (body.completed === false) {
      const existing = await prisma.dailyTask.findUnique({ where: { id } })
      const task = await updateDailyTask(id, { completedAt: null })
      if (existing?.type !== 'todo' && !task.calendarEventId) {
        try {
          const eventId = createCalendarEvent(task.title, task.date, task.startAt, task.durationMinutes)
          if (eventId) {
            const updated = await updateDailyTask(id, { calendarEventId: eventId })
            return NextResponse.json(updated)
          }
        } catch { /* calendar unavailable */ }
      }
      return NextResponse.json(task)
    }
    // Field edits
    const fields: Partial<{ title: string; startAt: string | null; durationMinutes: number; type: string }> = {}
    if (typeof body.title === 'string') fields.title = body.title
    if ('startAt' in body) fields.startAt = body.startAt ?? null
    if (typeof body.durationMinutes === 'number') fields.durationMinutes = body.durationMinutes
    if (body.type === 'block' || body.type === 'todo') fields.type = body.type
    if (Object.keys(fields).length > 0) {
      const existing = await prisma.dailyTask.findUnique({ where: { id } })
      const task = await updateDailyTask(id, fields)
      const effectiveType = fields.type ?? existing?.type ?? 'block'
      if (effectiveType === 'todo') {
        if (existing?.calendarEventId) {
          deleteCalendarEvent(existing.calendarEventId)
          await updateDailyTask(id, { calendarEventId: null })
        }
      } else {
        if (existing?.calendarEventId) deleteCalendarEvent(existing.calendarEventId)
        try {
          const eventId = createCalendarEvent(task.title, task.date, task.startAt, task.durationMinutes)
          if (eventId) {
            const updated = await updateDailyTask(id, { calendarEventId: eventId })
            return NextResponse.json(updated)
          }
        } catch { /* calendar unavailable */ }
      }
      return NextResponse.json(task)
    }
    return NextResponse.json({ error: 'no valid fields' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
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

- [ ] **Step 5: Run tests**

```bash
npx vitest run tests/api/tasks.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 6: Run full suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/tasks/route.ts src/app/api/tasks/[id]/route.ts tests/api/tasks.test.ts
git commit -m "feat: tasks API accepts type field, skips calendar sync for todo tasks"
```

---

### Task 3: Reminders API — today filter

**Files:**
- Modify: `src/app/api/reminders/route.ts`
- Create: `tests/api/reminders.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/api/reminders.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockListUpcomingReminders = vi.fn()
const mockListRemindersForToday = vi.fn()
const mockCreateReminderRecord = vi.fn()

vi.mock('@/lib/db', () => ({
  listUpcomingReminders: mockListUpcomingReminders,
  listRemindersForToday: mockListRemindersForToday,
  createReminderRecord: mockCreateReminderRecord,
}))

vi.mock('@/lib/macos', () => ({
  createReminder: vi.fn().mockReturnValue('mac-id-1'),
}))

describe('GET /api/reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns all upcoming reminders by default', async () => {
    mockListUpcomingReminders.mockResolvedValue([{ id: 'r1', title: 'Review PR' }])
    const { GET } = await import('@/app/api/reminders/route')
    const res = await GET(new Request('http://localhost/api/reminders'))
    const data = await res.json()
    expect(mockListUpcomingReminders).toHaveBeenCalledOnce()
    expect(mockListRemindersForToday).not.toHaveBeenCalled()
    expect(data).toHaveLength(1)
  })

  it('returns only today reminders when ?today=1', async () => {
    mockListRemindersForToday.mockResolvedValue([{ id: 'r2', title: 'Submit report' }])
    const { GET } = await import('@/app/api/reminders/route')
    const res = await GET(new Request('http://localhost/api/reminders?today=1'))
    const data = await res.json()
    expect(mockListRemindersForToday).toHaveBeenCalledOnce()
    expect(mockListUpcomingReminders).not.toHaveBeenCalled()
    expect(data).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run tests/api/reminders.test.ts
```

Expected: FAIL — `GET` doesn't handle `?today=1` yet.

- [ ] **Step 3: Replace src/app/api/reminders/route.ts**

```ts
import { createReminderRecord, listRemindersForToday, listUpcomingReminders } from '@/lib/db'
import { createReminder } from '@/lib/macos'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('today') === '1') {
    const reminders = await listRemindersForToday()
    return NextResponse.json(reminders)
  }
  const reminders = await listUpcomingReminders()
  return NextResponse.json(reminders)
}

export async function POST(req: Request) {
  const body = await req.json() as { title: string; dueAt: string; notes?: string }
  if (!body.title || !body.dueAt) {
    return NextResponse.json({ error: 'title and dueAt are required' }, { status: 400 })
  }
  const dueAt = new Date(body.dueAt)
  const reminderId = createReminder(body.title, dueAt, body.notes)
  const reminder = await createReminderRecord({
    title: body.title,
    dueAt,
    notes: body.notes,
    reminderId: reminderId ?? undefined,
  })
  return NextResponse.json(reminder, { status: 201 })
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/api/reminders.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Run full suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/reminders/route.ts tests/api/reminders.test.ts
git commit -m "feat: reminders API supports ?today=1 filter"
```

---

### Task 4: Today panel — task type toggle and conditional rendering

**Files:**
- Modify: `src/components/notes/TodayPanel.tsx`

- [ ] **Step 1: Add taskType state**

In `TodayPanel`, add state after the `loading` state declaration:

```tsx
const [taskType, setTaskType] = useState<'block' | 'todo'>('block')
```

- [ ] **Step 2: Replace the input section JSX**

Find the `{/* Input */}` section (from `<div className="px-4 py-3 border-b...">` through its closing `</div>`) and replace it with:

```tsx
{/* Input */}
<div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0">
  <div className="flex items-center gap-2">
    <input
      ref={inputRef}
      value={input}
      onChange={(e) => setInput(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
      placeholder={taskType === 'block' ? 'Add a block… (e.g. "gym 9am 1hr")' : 'Add a to-do…'}
      disabled={loading}
      className="flex-1 text-sm bg-transparent border-none outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 transition-opacity duration-150 disabled:opacity-50"
    />
    {loading && (
      <span className="text-xs text-zinc-400 animate-pulse">parsing…</span>
    )}
  </div>
  <div className="flex items-center gap-1 mt-1.5">
    {(['block', 'todo'] as const).map((t) => (
      <button
        key={t}
        onClick={() => setTaskType(t)}
        className={`text-xs px-2.5 py-0.5 rounded-full transition-all duration-150 ${
          taskType === t
            ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium'
            : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400'
        }`}
      >
        {t === 'block' ? 'Block' : 'To-do'}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 3: Pass taskType through handleAdd**

Replace the `handleAdd` function:

```tsx
const handleAdd = useCallback(async () => {
  const raw = input.trim()
  if (!raw) return
  setInput('')
  setLoading(true)
  try {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawInput: raw, date, type: taskType }),
    })
    if (res.ok) {
      const task = (await res.json()) as DailyTask
      setNewIds((prev) => new Set(prev).add(task.id))
      setTasks((prev) => {
        const next = [...prev, task]
        return next.sort((a, b) => {
          if (!a.startAt && !b.startAt) return 0
          if (!a.startAt) return 1
          if (!b.startAt) return -1
          return a.startAt.localeCompare(b.startAt)
        })
      })
      setTimeout(() => setNewIds((prev) => { const s = new Set(prev); s.delete(task.id); return s }), 600)
    }
  } finally {
    setLoading(false)
    inputRef.current?.focus()
  }
}, [input, date, taskType])
```

- [ ] **Step 4: Update drag handler to skip time-swap for todo tasks**

Replace the `handleDragEnd` function:

```tsx
const handleDragEnd = (e: DragEndEvent) => {
  setActiveId(null)
  const { active, over } = e
  if (!over || active.id === over.id) return

  setTasks((prev) => {
    const oldIndex = prev.findIndex((t) => t.id === active.id)
    const newIndex = prev.findIndex((t) => t.id === over.id)
    const reordered = arrayMove(prev, oldIndex, newIndex)

    const a = prev[oldIndex]
    const b = prev[newIndex]
    if (a.type !== 'todo' && b.type !== 'todo' && (a.startAt || b.startAt)) {
      const aTime = { startAt: a.startAt, durationMinutes: a.durationMinutes }
      const bTime = { startAt: b.startAt, durationMinutes: b.durationMinutes }
      fetch(`/api/tasks/${a.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bTime) })
      fetch(`/api/tasks/${b.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(aTime) })
      return reordered.map((t) => {
        if (t.id === a.id) return { ...t, ...bTime }
        if (t.id === b.id) return { ...t, ...aTime }
        return t
      })
    }

    return reordered
  })
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/notes/TodayPanel.tsx
git commit -m "feat: block/to-do type toggle in Today UI input"
```

---

### Task 5: Today panel — completable reminders section

**Files:**
- Modify: `src/components/notes/TodayPanel.tsx`

- [ ] **Step 1: Add Reminder import**

At the top of `TodayPanel.tsx`, update the Prisma import to include `Reminder`:

```tsx
import type { DailyTask, Reminder } from '@prisma/client'
```

- [ ] **Step 2: Add reminder state to TodayPanel**

After the existing `const [activeId, setActiveId] = useState<string | null>(null)` line, add:

```tsx
const [reminders, setReminders] = useState<Reminder[]>([])
const [completingReminderIds, setCompletingReminderIds] = useState<Set<string>>(new Set())
```

- [ ] **Step 3: Add fetchReminders and its useEffect**

After the existing `fetchTasks` `useCallback` and its `useEffect`, add:

```tsx
const fetchReminders = useCallback(async () => {
  const res = await fetch('/api/reminders?today=1')
  if (res.ok) setReminders(await res.json())
}, [])

useEffect(() => {
  fetchReminders()
}, [fetchReminders])
```

- [ ] **Step 4: Add handleCompleteReminder**

After the existing `handleUpdate` function, add:

```tsx
const handleCompleteReminder = useCallback(async (id: string) => {
  setCompletingReminderIds((prev) => new Set(prev).add(id))
  setTimeout(async () => {
    setReminders((prev) => prev.filter((r) => r.id !== id))
    setCompletingReminderIds((prev) => { const s = new Set(prev); s.delete(id); return s })
    await fetch(`/api/reminders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completedAt: new Date().toISOString() }),
    })
  }, 250)
}, [])
```

- [ ] **Step 5: Add helper functions above TodayPanel**

Add these two helpers just before the `export function TodayPanel` declaration:

```tsx
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatReminderTime(date: Date): string {
  const now = new Date()
  if (isSameDay(date, now)) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
```

- [ ] **Step 6: Add ReminderRow component**

Add just before `isSameDay` (i.e., before the helpers added in Step 5):

```tsx
function ReminderRow({
  reminder,
  onComplete,
  completing,
}: {
  reminder: Reminder
  onComplete: (id: string) => void
  completing: boolean
}) {
  const isOverdue = !isSameDay(new Date(reminder.dueAt), new Date()) && new Date(reminder.dueAt) < new Date()

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800 transition-all duration-250 overflow-hidden"
      style={{
        opacity: completing ? 0 : 1,
        maxHeight: completing ? '0px' : '60px',
      }}
    >
      <div className="w-3 flex-shrink-0" />
      <input
        type="checkbox"
        checked={false}
        onChange={() => onComplete(reminder.id)}
        className="w-4 h-4 rounded accent-zinc-600 flex-shrink-0 cursor-pointer"
      />
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">{reminder.title}</span>
        <span className={`text-xs flex-shrink-0 ${isOverdue ? 'text-red-400' : 'text-zinc-400'}`}>
          {formatReminderTime(new Date(reminder.dueAt))}
        </span>
      </div>
    </div>
  )
}
```

Note: `ReminderRow` calls `isSameDay` which is defined right after it — that's fine since both are at module scope.

- [ ] **Step 7: Add reminders section to TodayPanel JSX**

Inside the `{/* Task list */}` scrollable div, after the closing `</DndContext>` tag, add:

```tsx
{reminders.length > 0 && (
  <div>
    <div className="px-4 pt-4 pb-1.5">
      <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
        Reminders
      </span>
    </div>
    {reminders.map((r) => (
      <ReminderRow
        key={r.id}
        reminder={r}
        onComplete={handleCompleteReminder}
        completing={completingReminderIds.has(r.id)}
      />
    ))}
  </div>
)}
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/components/notes/TodayPanel.tsx
git commit -m "feat: completable today's reminders section in Today UI"
```
