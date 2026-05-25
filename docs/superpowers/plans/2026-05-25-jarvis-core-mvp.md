# Jarvis Core MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Jarvis into a Notes PWA (`/notes`) and a Jarvis chat+memory PWA (`/jarvis`), sharing one Next.js + Prisma backend with an AI intelligence layer that maintains a structured memory of the user.

**Architecture:** New Prisma schema (Note, JarvisMemory, ChatMessage, CalendarEvent). Notes UI uses Tiptap for rich text with interactive checklists. Jarvis UI has a streaming chat interface and an editable Memory view. On every chat call the intelligence layer builds a context snapshot (memory + notes + calendar), sends it to the LLM with a web search tool available, and asynchronously updates JarvisMemory after each turn.

**Tech Stack:** Next.js 16 (App Router), Prisma + SQLite, Tailwind CSS 4, Tiptap, Vitest, TypeScript, Tavily (web search)

---

## Out of Scope (separate plans)

- Electron wrapper for Notes on Mac
- Apple Calendar integration
- Voice interface

---

## File Map

### Delete
- `src/app/page.tsx` → replaced by root redirect
- `src/app/goals/` → remove entire directory
- `src/app/tasks/` → remove entire directory
- `src/app/reflections/` → remove entire directory
- `src/app/api/recommend/` → remove entire directory
- `src/components/PendingSuggestionsList.tsx`
- `src/components/WhatNextPanel.tsx`
- `src/components/SectionCard.tsx`
- `src/components/AppNav.tsx`
- `src/lib/jarvis/recommend-service.ts`
- `src/lib/llm/apply-suggestion.ts`
- `src/lib/memory/build-context.ts`
- `src/lib/actions.ts`

### Create / Rewrite
- `vitest.config.ts`
- `tests/setup.ts`
- `prisma/schema.prisma` — new schema
- `src/lib/db/notes.ts` — note CRUD
- `src/lib/db/memory.ts` — memory read/write
- `src/lib/db/chat.ts` — chat messages
- `src/lib/db/calendar.ts` — calendar event cache
- `src/lib/db/index.ts` — re-exports
- `src/lib/llm/types.ts` — rewritten
- `src/lib/llm/client.ts` — add tool-calling + web search
- `src/lib/llm/prompts.ts` — rewritten
- `src/lib/jarvis/context-builder.ts` — builds LLM context from DB
- `src/lib/jarvis/chat-service.ts` — rewritten (direct writes, no approval)
- `src/lib/jarvis/memory-service.ts` — async memory update after each turn
- `src/app/layout.tsx` — minimal root layout
- `src/app/page.tsx` — redirect to /jarvis
- `src/app/notes/layout.tsx`
- `src/app/notes/page.tsx`
- `src/app/jarvis/layout.tsx`
- `src/app/jarvis/page.tsx`
- `src/app/api/notes/route.ts` — GET list, POST create
- `src/app/api/notes/[id]/route.ts` — GET, PUT, DELETE
- `src/app/api/memory/route.ts` — GET, PUT
- `src/app/api/chat/route.ts` — rewritten
- `src/components/notes/NotesClient.tsx` — client shell
- `src/components/notes/NoteList.tsx` — sidebar list
- `src/components/notes/NoteEditor.tsx` — Tiptap editor
- `src/components/jarvis/JarvisClient.tsx` — client shell with tabs
- `src/components/jarvis/ChatInterface.tsx` — conversation UI
- `src/components/jarvis/MemoryView.tsx` — memory cards
- `src/components/jarvis/MemoryCard.tsx` — individual editable card
- `tests/lib/db/notes.test.ts`
- `tests/lib/db/memory.test.ts`
- `tests/lib/jarvis/context-builder.test.ts`
- `tests/lib/jarvis/memory-service.test.ts`

---

## Phase 1: Foundation

### Task 1: Test setup + install dependencies

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Modify: `package.json`

- [ ] **Step 1: Install dependencies**

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-task-list @tiptap/extension-task-item
npm install -D vitest @vitest/ui vite-tsconfig-paths
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
})
```

- [ ] **Step 3: Create `tests/setup.ts`**

```ts
process.env.DATABASE_URL = 'file:./prisma/test.db'
```

- [ ] **Step 4: Add test scripts to `package.json`**

Add inside `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

- [ ] **Step 5: Verify Vitest works**

```bash
mkdir -p tests/lib/db && echo "import { describe, it, expect } from 'vitest'\ndescribe('setup', () => { it('works', () => expect(1+1).toBe(2)) })" > tests/smoke.test.ts
npm test
```

Expected: 1 test passes.

- [ ] **Step 6: Remove smoke test**

```bash
rm tests/smoke.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts tests/setup.ts package.json package-lock.json
git commit -m "feat: add Vitest test setup and Tiptap/deps"
```

---

### Task 2: New Prisma schema + migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Replace `prisma/schema.prisma` entirely**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

enum ChatRole {
  user
  assistant
}

model Note {
  id        String   @id @default(cuid())
  title     String   @default("")
  content   String   @default("")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([updatedAt])
}

model JarvisMemory {
  id        String   @id @default("default")
  data      Json     @default("{}")
  updatedAt DateTime @updatedAt
}

model ChatMessage {
  id        String   @id @default(cuid())
  role      ChatRole
  content   String
  createdAt DateTime @default(now())

  @@index([createdAt])
}

model CalendarEvent {
  id         String   @id @default(cuid())
  externalId String   @unique
  title      String
  startAt    DateTime
  endAt      DateTime
  syncedAt   DateTime @default(now())

  @@index([startAt])
}
```

- [ ] **Step 2: Create and apply migration**

```bash
npx prisma migrate dev --name redesign-schema
```

Expected output: migration file created in `prisma/migrations/`, Prisma client regenerated.

- [ ] **Step 3: Apply migration to test DB**

```bash
DATABASE_URL="file:./prisma/test.db" npx prisma migrate deploy
```

- [ ] **Step 4: Verify schema with Prisma Studio (optional)**

```bash
npx prisma studio
```

Close it after verifying the four tables exist.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: replace schema with Note, JarvisMemory, ChatMessage, CalendarEvent"
```

---

## Phase 2: DB Layer

### Task 3: Note CRUD functions

**Files:**
- Create: `src/lib/db/notes.ts`
- Create: `tests/lib/db/notes.test.ts`

- [ ] **Step 1: Write failing tests in `tests/lib/db/notes.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  createNote,
  getNote,
  listNotes,
  updateNote,
  deleteNote,
} from '@/lib/db/notes'

beforeEach(async () => {
  await prisma.note.deleteMany()
})

describe('createNote', () => {
  it('extracts title from markdown heading', async () => {
    const note = await createNote('# My Goal\nLearn Spanish by December.')
    expect(note.title).toBe('My Goal')
  })

  it('handles plain text — uses first line as title', async () => {
    const note = await createNote('Learn Spanish by December.')
    expect(note.title).toBe('Learn Spanish by December.')
  })

  it('extracts title from Tiptap HTML heading', async () => {
    const note = await createNote('<h1>My Goal</h1><p>Learn Spanish</p>')
    expect(note.title).toBe('My Goal')
  })

  it('creates an empty note when content is empty', async () => {
    const note = await createNote('')
    expect(note.title).toBe('')
    expect(note.content).toBe('')
  })
})

describe('listNotes', () => {
  it('returns notes sorted by updatedAt descending', async () => {
    const a = await createNote('First note')
    await new Promise((r) => setTimeout(r, 10))
    const b = await createNote('Second note')
    const notes = await listNotes()
    expect(notes[0].id).toBe(b.id)
    expect(notes[1].id).toBe(a.id)
  })
})

describe('updateNote', () => {
  it('updates content and re-derives title', async () => {
    const note = await createNote('Old title\nOld body')
    const updated = await updateNote(note.id, '# New Title\nNew body')
    expect(updated.title).toBe('New Title')
    expect(updated.content).toBe('# New Title\nNew body')
  })
})

describe('deleteNote', () => {
  it('deletes a note by id', async () => {
    const note = await createNote('To delete')
    await deleteNote(note.id)
    const found = await getNote(note.id)
    expect(found).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test tests/lib/db/notes.test.ts
```

Expected: errors about missing module `@/lib/db/notes`.

- [ ] **Step 3: Create `src/lib/db/notes.ts`**

The `content` field stores HTML (Tiptap's `getHTML()` output). `deriveTitle` handles both HTML and plain text/markdown since tests use plain strings.

```ts
import { prisma } from '@/lib/prisma'

export function deriveTitle(content: string): string {
  if (content.trimStart().startsWith('<')) {
    // HTML from Tiptap — extract text from first heading or paragraph
    const headingMatch = content.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i)
    if (headingMatch) return headingMatch[1].replace(/<[^>]+>/g, '').trim()
    const pMatch = content.match(/<p[^>]*>(.*?)<\/p>/i)
    if (pMatch) return pMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 80)
    return ''
  }
  // Plain text / markdown
  const firstLine = content.split('\n').find((l) => l.trim() !== '') ?? ''
  return firstLine.replace(/^#+\s*/, '').trim()
}

export async function createNote(content: string) {
  return prisma.note.create({
    data: { content, title: deriveTitle(content) },
  })
}

export async function getNote(id: string) {
  return prisma.note.findUnique({ where: { id } })
}

export async function listNotes() {
  return prisma.note.findMany({ orderBy: { updatedAt: 'desc' } })
}

export async function updateNote(id: string, content: string) {
  return prisma.note.update({
    where: { id },
    data: { content, title: deriveTitle(content) },
  })
}

export async function deleteNote(id: string) {
  return prisma.note.delete({ where: { id } })
}
```

- [ ] **Step 4: Run tests — expect all to pass**

```bash
npm test tests/lib/db/notes.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/notes.ts tests/lib/db/notes.test.ts
git commit -m "feat: note CRUD db functions"
```

---

### Task 4: Memory functions

**Files:**
- Create: `src/lib/db/memory.ts`
- Create: `src/lib/llm/types.ts` (memory type definitions)
- Create: `tests/lib/db/memory.test.ts`

- [ ] **Step 1: Create `src/lib/llm/types.ts`**

```ts
export interface MemoryGoal {
  title: string
  horizon: 'long_term' | 'short_term'
  target?: string
  lastEngaged?: string
  priority?: 'low' | 'medium' | 'high'
}

export interface MemoryHabit {
  title: string
  frequency?: string
  lastMentioned?: string
}

export interface JarvisMemoryData {
  goals: MemoryGoal[]
  habits: MemoryHabit[]
  interests: string[]
  patterns: string[]
  keyFacts: string[]
  preferences: Record<string, string>
}

export const EMPTY_MEMORY: JarvisMemoryData = {
  goals: [],
  habits: [],
  interests: [],
  patterns: [],
  keyFacts: [],
  preferences: {},
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}
```

- [ ] **Step 2: Write failing tests in `tests/lib/db/memory.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { getMemory, setMemory } from '@/lib/db/memory'
import type { JarvisMemoryData } from '@/lib/llm/types'

beforeEach(async () => {
  await prisma.jarvisMemory.deleteMany()
})

describe('getMemory', () => {
  it('returns empty memory when no record exists', async () => {
    const mem = await getMemory()
    expect(mem.goals).toEqual([])
    expect(mem.habits).toEqual([])
    expect(mem.interests).toEqual([])
  })
})

describe('setMemory', () => {
  it('creates the memory record if it does not exist', async () => {
    const data: JarvisMemoryData = {
      goals: [{ title: 'Learn Spanish', horizon: 'long_term' }],
      habits: [],
      interests: ['guitar'],
      patterns: [],
      keyFacts: [],
      preferences: {},
    }
    await setMemory(data)
    const mem = await getMemory()
    expect(mem.goals[0].title).toBe('Learn Spanish')
    expect(mem.interests).toContain('guitar')
  })

  it('overwrites existing memory', async () => {
    await setMemory({ goals: [{ title: 'Old', horizon: 'short_term' }], habits: [], interests: [], patterns: [], keyFacts: [], preferences: {} })
    await setMemory({ goals: [{ title: 'New', horizon: 'long_term' }], habits: [], interests: [], patterns: [], keyFacts: [], preferences: {} })
    const mem = await getMemory()
    expect(mem.goals).toHaveLength(1)
    expect(mem.goals[0].title).toBe('New')
  })
})
```

- [ ] **Step 3: Run tests — expect failures**

```bash
npm test tests/lib/db/memory.test.ts
```

Expected: errors about missing `@/lib/db/memory`.

- [ ] **Step 4: Create `src/lib/db/memory.ts`**

```ts
import { prisma } from '@/lib/prisma'
import { EMPTY_MEMORY, type JarvisMemoryData } from '@/lib/llm/types'

export async function getMemory(): Promise<JarvisMemoryData> {
  const row = await prisma.jarvisMemory.findUnique({ where: { id: 'default' } })
  if (!row) return { ...EMPTY_MEMORY }
  return row.data as JarvisMemoryData
}

export async function setMemory(data: JarvisMemoryData): Promise<void> {
  await prisma.jarvisMemory.upsert({
    where: { id: 'default' },
    create: { id: 'default', data: data as object },
    update: { data: data as object },
  })
}
```

- [ ] **Step 5: Run tests — expect all pass**

```bash
npm test tests/lib/db/memory.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/llm/types.ts src/lib/db/memory.ts tests/lib/db/memory.test.ts
git commit -m "feat: JarvisMemoryData types and memory db functions"
```

---

### Task 5: Chat and CalendarEvent DB functions + re-export index

**Files:**
- Create: `src/lib/db/chat.ts`
- Create: `src/lib/db/calendar.ts`
- Create: `src/lib/db/index.ts`

- [ ] **Step 1: Create `src/lib/db/chat.ts`**

```ts
import { ChatRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function getRecentChatMessages(limit = 20) {
  const rows = await prisma.chatMessage.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
  })
  return rows.reverse()
}

export async function appendChatMessages(
  entries: { role: 'user' | 'assistant'; content: string }[],
) {
  await prisma.chatMessage.createMany({
    data: entries.map((e) => ({
      role: e.role === 'user' ? ChatRole.user : ChatRole.assistant,
      content: e.content,
    })),
  })
}
```

- [ ] **Step 2: Create `src/lib/db/calendar.ts`**

```ts
import { prisma } from '@/lib/prisma'

export async function getUpcomingCalendarEvents(days = 7) {
  const now = new Date()
  const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
  return prisma.calendarEvent.findMany({
    where: { startAt: { gte: now, lte: until } },
    orderBy: { startAt: 'asc' },
  })
}

export async function upsertCalendarEvent(event: {
  externalId: string
  title: string
  startAt: Date
  endAt: Date
}) {
  return prisma.calendarEvent.upsert({
    where: { externalId: event.externalId },
    create: { ...event, syncedAt: new Date() },
    update: { ...event, syncedAt: new Date() },
  })
}
```

- [ ] **Step 3: Create `src/lib/db/index.ts`**

```ts
export * from './notes'
export * from './memory'
export * from './chat'
export * from './calendar'
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/
git commit -m "feat: chat and calendar db functions, db index"
```

---

## Phase 3: LLM + Intelligence Layer

### Task 6: LLM client with tool calling

**Files:**
- Modify: `src/lib/llm/client.ts`

The new client supports tool calling. Jarvis uses one tool: `web_search`. The loop runs at most two iterations: one possible tool call, then the final answer.

- [ ] **Step 1: Replace `src/lib/llm/client.ts`**

```ts
export class LlmError extends Error {
  constructor(message: string, public status?: number) {
    super(message)
    this.name = 'LlmError'
  }
}

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_call_id?: string
}

interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

const WEB_SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Search the web for current information.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
}

async function tavilySearch(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) return '(web search unavailable — TAVILY_API_KEY not set)'

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query, max_results: 5, search_depth: 'basic' }),
  })

  if (!res.ok) return `(search failed: ${res.status})`

  const body = (await res.json()) as {
    results?: Array<{ title: string; url: string; content: string }>
  }

  return (body.results ?? [])
    .slice(0, 5)
    .map((r) => `**${r.title}**\n${r.content}\nSource: ${r.url}`)
    .join('\n\n---\n\n')
}

export async function chat(messages: Message[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new LlmError('OPENAI_API_KEY is not set', 503)

  const base = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o'

  const callLlm = async (msgs: Message[]) => {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, temperature: 0.6, messages: msgs, tools: [WEB_SEARCH_TOOL] }),
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

  let body = await callLlm(messages)
  const choice = body.choices[0]

  if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
    const tc = choice.message.tool_calls[0]
    const args = JSON.parse(tc.function.arguments) as { query: string }
    const searchResult = await tavilySearch(args.query)

    const extended: Message[] = [
      ...messages,
      { role: 'assistant', content: choice.message.content ?? '', tool_call_id: undefined },
      { role: 'tool', content: searchResult, tool_call_id: tc.id },
    ]

    body = await callLlm(extended)
  }

  const text = body.choices[0]?.message?.content
  if (!text || typeof text !== 'string') throw new LlmError('Empty LLM response', 502)
  return text
}

export async function chatJson(messages: Message[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new LlmError('OPENAI_API_KEY is not set', 503)

  const base = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o'

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages,
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new LlmError(`LLM request failed (${res.status}): ${err.slice(0, 800) || res.statusText}`, res.status)
  }

  const body = (await res.json()) as { choices: Array<{ message: { content?: string | null } }> }
  const text = body.choices?.[0]?.message?.content
  if (!text || typeof text !== 'string') throw new LlmError('Empty LLM response', 502)
  return text
}
```

- [ ] **Step 2: Add `TAVILY_API_KEY` to `.env.example`**

Append to `.env.example`:
```
TAVILY_API_KEY=your-tavily-api-key
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/llm/client.ts .env.example
git commit -m "feat: LLM client with tool-calling and Tavily web search"
```

---

### Task 7: Prompts and context builder

**Files:**
- Modify: `src/lib/llm/prompts.ts`
- Create: `src/lib/jarvis/context-builder.ts`
- Create: `tests/lib/jarvis/context-builder.test.ts`

- [ ] **Step 1: Rewrite `src/lib/llm/prompts.ts`**

```ts
export function jarvisChatSystemPrompt(): string {
  return `You are Jarvis, a personal planning partner and life coach. You know the user deeply through their notes and memory.

Personality: Direct, thoughtful, practical. Never sycophantic. Bias toward the smallest actionable next step. Honest about what you don't know.

Capabilities:
- Hold full planning conversations — strategy, prioritisation, brainstorming
- Answer questions using web_search when current information is needed
- Create and update notes in the user's notes app
- Create tasks as checklist items in notes
- Update what you know about the user (goals, habits, patterns)

When you act on the user's data, describe what you did inline in your response (e.g. "I've added that to your Goals note.").

You have access to the user's notes, goals, habits, calendar, and memory context — use them.

Output: plain conversational text (you may use markdown bullets when listing things). Do NOT wrap your response in JSON.`
}

export function jarvisMemoryUpdatePrompt(
  existingMemory: string,
  userMessage: string,
  assistantReply: string,
): string {
  return `You maintain a structured memory about a user for their personal AI assistant, Jarvis.

Given the existing memory JSON and the latest exchange, return an updated memory JSON. Rules:
- Add new goals, habits, interests, facts, or patterns you learned
- Update lastEngaged/lastMentioned timestamps to today's date (${new Date().toISOString().slice(0, 10)}) when the topic came up
- Remove entries that were explicitly cancelled or are clearly outdated
- If nothing meaningful changed, return the memory unchanged
- Return ONLY a valid JSON object matching the schema — no markdown, no explanation

Memory schema:
{
  "goals": [{ "title": string, "horizon": "long_term"|"short_term", "target"?: string, "lastEngaged"?: string, "priority"?: "low"|"medium"|"high" }],
  "habits": [{ "title": string, "frequency"?: string, "lastMentioned"?: string }],
  "interests": string[],
  "patterns": string[],
  "keyFacts": string[],
  "preferences": Record<string, string>
}

EXISTING MEMORY:
${existingMemory}

LATEST EXCHANGE:
User: ${userMessage}
Jarvis: ${assistantReply}`
}
```

- [ ] **Step 2: Write failing test in `tests/lib/jarvis/context-builder.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest'
import { buildContext } from '@/lib/jarvis/context-builder'

vi.mock('@/lib/db', () => ({
  listNotes: vi.fn().mockResolvedValue([
    { id: 'n1', title: '2026 Goals', content: '# 2026 Goals\nLearn Spanish', updatedAt: new Date() },
  ]),
  getMemory: vi.fn().mockResolvedValue({
    goals: [{ title: 'Learn Spanish', horizon: 'long_term', lastEngaged: '2026-05-10' }],
    habits: [{ title: 'Duolingo', frequency: 'daily', lastMentioned: '2026-05-20' }],
    interests: ['guitar'],
    patterns: [],
    keyFacts: [],
    preferences: {},
  }),
  getRecentChatMessages: vi.fn().mockResolvedValue([]),
  getUpcomingCalendarEvents: vi.fn().mockResolvedValue([
    { id: 'c1', title: 'Team call', startAt: new Date('2026-05-26T10:00:00Z'), endAt: new Date('2026-05-26T11:00:00Z') },
  ]),
}))

describe('buildContext', () => {
  it('returns a context object with system prompt, messages, and memory text', async () => {
    const ctx = await buildContext([])
    expect(ctx.systemPrompt).toContain('Jarvis')
    expect(ctx.memoryText).toContain('Learn Spanish')
    expect(ctx.memoryText).toContain('Duolingo')
    expect(ctx.memoryText).toContain('Team call')
    expect(ctx.memoryText).toContain('2026 Goals')
  })

  it('includes provided messages in the output', async () => {
    const ctx = await buildContext([{ role: 'user', content: 'Hello' }])
    expect(ctx.messages.some((m) => m.content === 'Hello')).toBe(true)
  })
})
```

- [ ] **Step 3: Run tests — expect failures**

```bash
npm test tests/lib/jarvis/context-builder.test.ts
```

Expected: error about missing `@/lib/jarvis/context-builder`.

- [ ] **Step 4: Create `src/lib/jarvis/context-builder.ts`**

Note: note `content` is stored as HTML (Tiptap output). Strip tags before sending to the LLM.

```ts
import { getMemory, getRecentChatMessages, getUpcomingCalendarEvents, listNotes } from '@/lib/db'
import { jarvisChatSystemPrompt } from '@/lib/llm/prompts'
import type { ChatMessage, JarvisMemoryData } from '@/lib/llm/types'

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function formatMemory(mem: JarvisMemoryData, notes: { title: string; content: string }[], events: { title: string; startAt: Date }[]): string {
  const goalsBlock = mem.goals.length
    ? mem.goals.map((g) => `- [${g.horizon}/${g.priority ?? 'medium'}] ${g.title}${g.target ? ` — ${g.target}` : ''}${g.lastEngaged ? ` (last engaged: ${g.lastEngaged})` : ''}`).join('\n')
    : '(none)'

  const habitsBlock = mem.habits.length
    ? mem.habits.map((h) => `- ${h.title}${h.frequency ? ` (${h.frequency})` : ''}${h.lastMentioned ? `, last mentioned: ${h.lastMentioned}` : ''}`).join('\n')
    : '(none)'

  const notesBlock = notes.length
    ? notes.map((n) => {
        const plain = stripHtml(n.content).slice(0, 800)
        return `### ${n.title}\n${plain}${plain.length === 800 ? '…' : ''}`
      }).join('\n\n')
    : '(none)'

  const calendarBlock = events.length
    ? events.map((e) => `- ${e.startAt.toISOString().slice(0, 16).replace('T', ' ')}: ${e.title}`).join('\n')
    : '(none)'

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
  ].join('\n')
}

export async function buildContext(extraMessages: ChatMessage[]) {
  const [mem, notes, recentChat, events] = await Promise.all([
    getMemory(),
    listNotes(),
    getRecentChatMessages(20),
    getUpcomingCalendarEvents(7),
  ])

  const memoryText = formatMemory(mem, notes, events)

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

- [ ] **Step 5: Run tests — expect pass**

```bash
npm test tests/lib/jarvis/context-builder.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/llm/prompts.ts src/lib/jarvis/context-builder.ts tests/lib/jarvis/context-builder.test.ts
git commit -m "feat: LLM prompts and context builder"
```

---

### Task 8: Chat service + memory update service

**Files:**
- Modify: `src/lib/jarvis/chat-service.ts`
- Create: `src/lib/jarvis/memory-service.ts`
- Create: `tests/lib/jarvis/memory-service.test.ts`

- [ ] **Step 1: Rewrite `src/lib/jarvis/chat-service.ts`**

```ts
import { appendChatMessages } from '@/lib/db'
import { chat, LlmError } from '@/lib/llm/client'
import { buildContext } from './context-builder'
import { updateMemoryAsync } from './memory-service'

export async function runJarvisChat(userText: string) {
  const ctx = await buildContext([{ role: 'user', content: userText }])
  const reply = await chat(ctx.messages)

  await appendChatMessages([
    { role: 'user', content: userText },
    { role: 'assistant', content: reply },
  ])

  updateMemoryAsync(ctx.memory, userText, reply)

  return { message: reply }
}
```

- [ ] **Step 2: Write failing test in `tests/lib/jarvis/memory-service.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockChatJson = vi.fn()
const mockSetMemory = vi.fn()

vi.mock('@/lib/llm/client', () => ({ chatJson: mockChatJson }))
vi.mock('@/lib/db', () => ({ setMemory: mockSetMemory }))

import { updateMemoryAsync } from '@/lib/jarvis/memory-service'
import type { JarvisMemoryData } from '@/lib/llm/types'

const baseMemory: JarvisMemoryData = {
  goals: [],
  habits: [],
  interests: [],
  patterns: [],
  keyFacts: [],
  preferences: {},
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('updateMemoryAsync', () => {
  it('calls chatJson with a memory update prompt', async () => {
    const updated: JarvisMemoryData = { ...baseMemory, interests: ['guitar'] }
    mockChatJson.mockResolvedValueOnce(JSON.stringify(updated))

    await updateMemoryAsync(baseMemory, 'I love guitar', 'Great, keep it up!')

    expect(mockChatJson).toHaveBeenCalledOnce()
    const [messages] = mockChatJson.mock.calls[0]
    expect(messages[0].role).toBe('user')
    expect(messages[0].content).toContain('guitar')
  })

  it('saves the updated memory returned by the LLM', async () => {
    const updated: JarvisMemoryData = { ...baseMemory, interests: ['guitar'] }
    mockChatJson.mockResolvedValueOnce(JSON.stringify(updated))

    await updateMemoryAsync(baseMemory, 'I love guitar', 'Great!')

    expect(mockSetMemory).toHaveBeenCalledWith(updated)
  })

  it('does not throw if chatJson fails — just logs', async () => {
    mockChatJson.mockRejectedValueOnce(new Error('LLM down'))

    await expect(
      updateMemoryAsync(baseMemory, 'test', 'test'),
    ).resolves.toBeUndefined()

    expect(mockSetMemory).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run tests — expect failures**

```bash
npm test tests/lib/jarvis/memory-service.test.ts
```

Expected: error about missing `@/lib/jarvis/memory-service`.

- [ ] **Step 4: Create `src/lib/jarvis/memory-service.ts`**

```ts
import { setMemory } from '@/lib/db'
import { chatJson } from '@/lib/llm/client'
import { jarvisMemoryUpdatePrompt } from '@/lib/llm/prompts'
import type { JarvisMemoryData } from '@/lib/llm/types'

export async function updateMemoryAsync(
  currentMemory: JarvisMemoryData,
  userMessage: string,
  assistantReply: string,
): Promise<void> {
  try {
    const prompt = jarvisMemoryUpdatePrompt(
      JSON.stringify(currentMemory, null, 2),
      userMessage,
      assistantReply,
    )
    const raw = await chatJson([{ role: 'user', content: prompt }])
    const updated = JSON.parse(raw) as JarvisMemoryData
    await setMemory(updated)
  } catch (err) {
    console.error('[memory-service] failed to update memory:', err)
  }
}
```

- [ ] **Step 5: Run tests — expect all pass**

```bash
npm test tests/lib/jarvis/memory-service.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/jarvis/chat-service.ts src/lib/jarvis/memory-service.ts tests/lib/jarvis/memory-service.test.ts
git commit -m "feat: chat service and async memory update"
```

---

## Phase 4: API Routes

### Task 9: Notes API

**Files:**
- Create: `src/app/api/notes/route.ts`
- Create: `src/app/api/notes/[id]/route.ts`

- [ ] **Step 1: Create `src/app/api/notes/route.ts`**

```ts
import { createNote, listNotes } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const notes = await listNotes()
  return NextResponse.json(notes)
}

export async function POST(req: Request) {
  const body = (await req.json()) as { content?: string }
  const content = typeof body.content === 'string' ? body.content : ''
  const note = await createNote(content)
  return NextResponse.json(note, { status: 201 })
}
```

- [ ] **Step 2: Create `src/app/api/notes/[id]/route.ts`**

```ts
import { deleteNote, getNote, updateNote } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const note = await getNote(id)
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(note)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json()) as { content?: string }
  if (typeof body.content !== 'string') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }
  try {
    const note = await updateNote(id, body.content)
    return NextResponse.json(note)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await deleteNote(id)
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/notes/
git commit -m "feat: notes API routes (CRUD)"
```

---

### Task 10: Memory API + updated Chat API

**Files:**
- Create: `src/app/api/memory/route.ts`
- Modify: `src/app/api/chat/route.ts`

- [ ] **Step 1: Create `src/app/api/memory/route.ts`**

```ts
import { getMemory, setMemory } from '@/lib/db'
import type { JarvisMemoryData } from '@/lib/llm/types'
import { NextResponse } from 'next/server'

export async function GET() {
  const memory = await getMemory()
  return NextResponse.json(memory)
}

export async function PUT(req: Request) {
  const body = (await req.json()) as JarvisMemoryData
  await setMemory(body)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Replace `src/app/api/chat/route.ts`**

```ts
import { runJarvisChat } from '@/lib/jarvis/chat-service'
import { LlmError } from '@/lib/llm/client'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { message?: string }
    const text = typeof body.message === 'string' ? body.message.trim() : ''
    if (!text) return NextResponse.json({ error: 'message is required' }, { status: 400 })
    const result = await runJarvisChat(text)
    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof LlmError) {
      return NextResponse.json({ error: e.message }, { status: e.status && e.status >= 400 && e.status < 600 ? e.status : 502 })
    }
    console.error(e)
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/memory/ src/app/api/chat/route.ts
git commit -m "feat: memory API route, updated chat route"
```

---

## Phase 5: Remove Old Code

### Task 11: Delete old pages, components, and lib files

**Files:** multiple deletions

- [ ] **Step 1: Delete old pages**

```bash
rm -rf src/app/goals src/app/tasks src/app/reflections src/app/api/recommend
```

- [ ] **Step 2: Delete old components**

```bash
rm src/components/PendingSuggestionsList.tsx
rm src/components/WhatNextPanel.tsx
rm src/components/SectionCard.tsx
rm src/components/AppNav.tsx
```

- [ ] **Step 3: Delete old lib files**

```bash
rm src/lib/jarvis/recommend-service.ts
rm src/lib/llm/apply-suggestion.ts
rm src/lib/memory/build-context.ts
rm src/lib/actions.ts
```

- [ ] **Step 4: Update root layout at `src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Jarvis',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 antialiased">
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Replace root `src/app/page.tsx` with a redirect**

```tsx
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/jarvis')
}
```

- [ ] **Step 6: Build to check for compile errors**

```bash
npm run build 2>&1 | tail -30
```

Fix any TypeScript or import errors before continuing.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove old goals/tasks/reflections code and components"
```

---

## Phase 6: Notes UI

### Task 12: Notes page layout and route

**Files:**
- Create: `src/app/notes/layout.tsx`
- Create: `src/app/notes/page.tsx`

- [ ] **Step 1: Create `src/app/notes/layout.tsx`**

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Notes — Jarvis' }

export default function NotesLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-screen overflow-hidden">{children}</div>
}
```

- [ ] **Step 2: Create `src/app/notes/page.tsx`**

```tsx
import { listNotes } from '@/lib/db'
import { NotesClient } from '@/components/notes/NotesClient'

export default async function NotesPage() {
  const initialNotes = await listNotes()
  return <NotesClient initialNotes={initialNotes} />
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/notes/
git commit -m "feat: notes page route"
```

---

### Task 13: NoteList component

**Files:**
- Create: `src/components/notes/NoteList.tsx`

- [ ] **Step 1: Create `src/components/notes/NoteList.tsx`**

```tsx
'use client'

import type { Note } from '@prisma/client'

interface Props {
  notes: Note[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
}

function preview(content: string) {
  const lines = content.split('\n').filter((l) => l.trim())
  return lines.slice(1, 3).join(' ').replace(/^#+\s*/, '').slice(0, 80) || 'No additional text'
}

export function NoteList({ notes, selectedId, onSelect, onNew }: Props) {
  return (
    <div className="flex flex-col h-full w-64 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Notes</span>
        <button
          onClick={onNew}
          className="text-xl leading-none text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          aria-label="New note"
        >
          +
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 && (
          <p className="px-4 py-6 text-sm text-zinc-400">No notes yet. Hit + to create one.</p>
        )}
        {notes.map((note) => (
          <button
            key={note.id}
            onClick={() => onSelect(note.id)}
            className={`w-full text-left px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 transition-colors ${
              note.id === selectedId
                ? 'bg-zinc-200 dark:bg-zinc-700'
                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
              {note.title || 'Untitled'}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
              {preview(note.content)}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/notes/NoteList.tsx
git commit -m "feat: NoteList sidebar component"
```

---

### Task 14: NoteEditor (Tiptap) + NotesClient shell

**Files:**
- Create: `src/components/notes/NoteEditor.tsx`
- Create: `src/components/notes/NotesClient.tsx`

- [ ] **Step 1: Create `src/components/notes/NoteEditor.tsx`**

```tsx
'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { useEffect } from 'react'

interface Props {
  content: string
  onChange: (html: string) => void
}

export function NoteEditor({ content, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: false }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-full p-6',
      },
    },
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false)
    }
  }, [content, editor])

  return (
    <div className="flex-1 overflow-y-auto h-full">
      <EditorContent editor={editor} className="h-full" />
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/notes/NotesClient.tsx`**

```tsx
'use client'

import type { Note } from '@prisma/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { NoteEditor } from './NoteEditor'
import { NoteList } from './NoteList'

interface Props {
  initialNotes: Note[]
}

export function NotesClient({ initialNotes }: Props) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [selectedId, setSelectedId] = useState<string | null>(initialNotes[0]?.id ?? null)
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

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950">
      <NoteList
        notes={notes}
        selectedId={selectedId}
        onSelect={handleSelect}
        onNew={handleNew}
      />
      <div className="flex-1 overflow-hidden flex flex-col">
        {selectedNote ? (
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

- [ ] **Step 3: Add Tiptap task item styles to `src/app/globals.css`**

Append to `src/app/globals.css`:
```css
/* Tiptap task list */
ul[data-type="taskList"] {
  list-style: none;
  padding: 0;
}

ul[data-type="taskList"] li {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

ul[data-type="taskList"] li > label {
  flex-shrink: 0;
  margin-top: 2px;
}

ul[data-type="taskList"] li > div {
  flex: 1;
}

ul[data-type="taskList"] li[data-checked="true"] > div {
  text-decoration: line-through;
  opacity: 0.6;
}
```

- [ ] **Step 4: Start dev server and manually test Notes**

```bash
npm run dev
```

Open http://localhost:3000/notes. Verify:
- Note list shows in sidebar
- "+" creates a new note
- Typing in the editor auto-saves after 800ms
- Typing `- [ ] task item` and pressing Enter creates a checkbox list
- Clicking a checkbox toggles it

- [ ] **Step 5: Commit**

```bash
git add src/components/notes/ src/app/globals.css
git commit -m "feat: NoteEditor (Tiptap) and NotesClient shell"
```

---

## Phase 7: Jarvis UI

### Task 15: Jarvis page + ChatInterface

**Files:**
- Create: `src/app/jarvis/layout.tsx`
- Create: `src/app/jarvis/page.tsx`
- Create: `src/components/jarvis/JarvisClient.tsx`
- Create: `src/components/jarvis/ChatInterface.tsx`

- [ ] **Step 1: Create `src/app/jarvis/layout.tsx`**

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Jarvis' }

export default function JarvisLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-screen overflow-hidden">{children}</div>
}
```

- [ ] **Step 2: Create `src/app/jarvis/page.tsx`**

```tsx
import { getMemory } from '@/lib/db'
import { JarvisClient } from '@/components/jarvis/JarvisClient'

export default async function JarvisPage() {
  const initialMemory = await getMemory()
  return <JarvisClient initialMemory={initialMemory} />
}
```

- [ ] **Step 3: Create `src/components/jarvis/ChatInterface.tsx`**

```tsx
'use client'

import { useRef, useState } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hey, I'm Jarvis. What are you working on today?" },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = (await res.json()) as { message?: string; error?: string }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.message ?? data.error ?? 'Something went wrong.' },
      ])
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Network error. Try again.' }])
    } finally {
      setLoading(false)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                m.role === 'user'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl px-4 py-2.5 text-sm text-zinc-400">
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask Jarvis anything…"
            className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-500"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-sm font-medium disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/jarvis/ src/components/jarvis/ChatInterface.tsx
git commit -m "feat: Jarvis page and ChatInterface"
```

---

### Task 16: MemoryCard + MemoryView + JarvisClient shell

**Files:**
- Create: `src/components/jarvis/MemoryCard.tsx`
- Create: `src/components/jarvis/MemoryView.tsx`
- Create: `src/components/jarvis/JarvisClient.tsx`

- [ ] **Step 1: Create `src/components/jarvis/MemoryCard.tsx`**

```tsx
'use client'

import { useState } from 'react'

interface Props {
  label: string
  value: string
  onSave: (newValue: string) => void
  onDelete: () => void
}

export function MemoryCard({ label, value, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl">
      <div className="flex-1 min-w-0">
        {label && (
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">{label}</p>
        )}
        {editing ? (
          <div className="flex gap-2 mt-1">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { onSave(draft); setEditing(false) }
                if (e.key === 'Escape') { setDraft(value); setEditing(false) }
              }}
              className="flex-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg px-2 py-1 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            />
            <button onClick={() => { onSave(draft); setEditing(false) }} className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">Save</button>
          </div>
        ) : (
          <p className="text-sm text-zinc-800 dark:text-zinc-200 cursor-pointer" onClick={() => setEditing(true)}>{value}</p>
        )}
      </div>
      <button onClick={onDelete} className="text-zinc-300 hover:text-red-400 text-lg leading-none flex-shrink-0" aria-label="Delete">×</button>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/jarvis/MemoryView.tsx`**

```tsx
'use client'

import type { JarvisMemoryData, MemoryGoal, MemoryHabit } from '@/lib/llm/types'
import { useState } from 'react'
import { MemoryCard } from './MemoryCard'

interface Props {
  initialMemory: JarvisMemoryData
}

export function MemoryView({ initialMemory }: Props) {
  const [mem, setMem] = useState<JarvisMemoryData>(initialMemory)
  const [saving, setSaving] = useState(false)

  const save = async (updated: JarvisMemoryData) => {
    setMem(updated)
    setSaving(true)
    await fetch('/api/memory', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    setSaving(false)
  }

  const updateGoal = (i: number, field: keyof MemoryGoal, value: string) => {
    const goals = [...mem.goals]
    goals[i] = { ...goals[i], [field]: value }
    save({ ...mem, goals })
  }

  const deleteGoal = (i: number) => {
    save({ ...mem, goals: mem.goals.filter((_, j) => j !== i) })
  }

  const updateHabit = (i: number, value: string) => {
    const habits = [...mem.habits]
    habits[i] = { ...habits[i], title: value }
    save({ ...mem, habits })
  }

  const deleteHabit = (i: number) => {
    save({ ...mem, habits: mem.habits.filter((_, j) => j !== i) })
  }

  const updateListItem = (key: 'interests' | 'keyFacts' | 'patterns', i: number, value: string) => {
    const arr = [...mem[key]]
    arr[i] = value
    save({ ...mem, [key]: arr })
  }

  const deleteListItem = (key: 'interests' | 'keyFacts' | 'patterns', i: number) => {
    save({ ...mem, [key]: mem[key].filter((_, j) => j !== i) })
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">What Jarvis knows about you</h2>
        {saving && <span className="text-xs text-zinc-400">Saving…</span>}
      </div>

      {(['goals', 'habits', 'interests', 'keyFacts', 'patterns'] as const).map((section) => (
        <div key={section}>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">
            {section === 'keyFacts' ? 'Key Facts' : section.charAt(0).toUpperCase() + section.slice(1)}
          </h3>
          <div className="space-y-2">
            {section === 'goals' && mem.goals.map((g, i) => (
              <MemoryCard key={i} label={g.horizon} value={g.title} onSave={(v) => updateGoal(i, 'title', v)} onDelete={() => deleteGoal(i)} />
            ))}
            {section === 'habits' && mem.habits.map((h, i) => (
              <MemoryCard key={i} label={h.frequency ?? ''} value={h.title} onSave={(v) => updateHabit(i, v)} onDelete={() => deleteHabit(i)} />
            ))}
            {(section === 'interests' || section === 'keyFacts' || section === 'patterns') && mem[section].map((item, i) => (
              <MemoryCard key={i} label="" value={item} onSave={(v) => updateListItem(section, i, v)} onDelete={() => deleteListItem(section, i)} />
            ))}
            {section === 'goals' && mem.goals.length === 0 && <p className="text-sm text-zinc-400">No goals yet — tell Jarvis about your goals in chat.</p>}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create `src/components/jarvis/JarvisClient.tsx`**

```tsx
'use client'

import type { JarvisMemoryData } from '@/lib/llm/types'
import { useState } from 'react'
import { ChatInterface } from './ChatInterface'
import { MemoryView } from './MemoryView'

type Tab = 'jarvis' | 'memory'

interface Props {
  initialMemory: JarvisMemoryData
}

export function JarvisClient({ initialMemory }: Props) {
  const [tab, setTab] = useState<Tab>('jarvis')

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-zinc-950">
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-4">
        {(['jarvis', 'memory'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'border-b-2 border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            {t === 'jarvis' ? 'Jarvis' : 'Memory'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {tab === 'jarvis' ? <ChatInterface /> : <MemoryView initialMemory={initialMemory} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Start dev server and manually test Jarvis**

```bash
npm run dev
```

Open http://localhost:3000/jarvis. Verify:
- Chat tab shows the conversation interface
- Sending a message calls `/api/chat` and shows the response
- Memory tab shows the memory cards (empty initially)
- Editing a memory card saves to `/api/memory`
- Delete button removes the card

- [ ] **Step 5: Commit**

```bash
git add src/components/jarvis/
git commit -m "feat: MemoryCard, MemoryView, JarvisClient — Jarvis UI complete"
```

---

## Phase 8: Final check

### Task 17: Run full test suite + build check

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: all tests pass. Fix any failures before continuing.

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: End-to-end smoke test**

```bash
npm run dev
```

1. Open http://localhost:3000 — verify redirect to `/jarvis`
2. Open http://localhost:3000/notes — create a note with a checklist item, verify it saves
3. Open http://localhost:3000/jarvis — send "Hey Jarvis, what should I work on today?"
4. Verify a response comes back (requires `OPENAI_API_KEY` set in `.env`)
5. Open Memory tab — verify it shows any facts Jarvis extracted

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: Jarvis core MVP — Notes PWA + Jarvis chat/memory PWA"
```

---

## Next Plans (not in scope here)

- `2026-05-25-jarvis-electron-notes.md` — Electron wrapper for the Notes app on Mac (dock icon, system tray)
- `2026-05-25-jarvis-calendar-integration.md` — Apple Calendar read/write via AppleScript bridge
