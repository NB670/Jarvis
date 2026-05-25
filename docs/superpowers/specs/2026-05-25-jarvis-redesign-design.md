# Jarvis Redesign — Design Spec

**Date:** 2026-05-25
**Status:** Approved

## Overview

Jarvis is a personal AI planning partner built as two clients sharing one backend:

- **Notes app** — a dedicated writing surface on Mac (Electron, in the dock) and phone (PWA). Apple Notes-style: note list + editor, inline checklists, nothing else. Same frontend code deployed to both targets.
- **Jarvis app** — a PWA (browser on Mac, phone, eventually replaced by voice). Two sections: Chat (full planning conversations + daily brief) and Memory (what Jarvis knows about you, editable). The chat UI is secondary — voice is the long-term primary interface.

One shared Next.js + Prisma backend serves both. Notes are just data in the same database that Jarvis reads as context. No sync layer needed.

The guiding principle: **Jarvis knows you.** Notes, chat, and voice are all just ways to communicate with it. The memory is what persists and grows.

---

## Architecture

### Layers

```
Input Channels          Jarvis Intelligence         Outputs
──────────────          ───────────────────         ───────
Notes (user writes)  →                          →  Chat responses
Chat (conversation)  →  Memory Core (JSON)      →  Create/update notes
Calendar (sync)      →  LLM + Web Search        →  Create calendar events
Voice (future)       →                          →  Update memory
```

Notes, chat, and voice are all equal input channels. The memory core is the persistent brain.

### Two Clients, One Backend

```
┌─────────────────┐      ┌──────────────────────────┐
│   Notes Client  │      │      Jarvis Client        │
│  (phone + mac)  │      │      (macOS Electron)     │
│                 │      │                           │
│  Note list      │      │  Chat + Brief             │
│  Editor         │      │  Memory                   │
│  Checklists     │      │  System tray popover      │
└────────┬────────┘      └────────────┬─────────────┘
         │                            │
         └──────────┬─────────────────┘
                    ▼
         ┌──────────────────┐
         │  Next.js + Prisma │
         │  (shared backend) │
         └──────────────────┘
```

**Notes client:**
- **Mac:** Electron app in the dock. Main process handles system tray (quick new note), Apple Calendar sync via AppleScript bridge. Renderer is the Next.js Notes UI.
- **Phone:** Same Next.js Notes frontend served as a PWA (mobile Safari). Full-screen editor on small screens, list/editor split on larger screens.

**Jarvis client (PWA only):**
- Served by the same Next.js backend, accessible in any browser.
- No Electron wrapper — the primary long-term interface is voice, not a desktop window.
- System tray / quick access handled by the Notes Electron app instead.

---

## Data Model

Three tables. Everything else is gone (Goals, Tasks, Reflections, SuggestedUpdates, AppState removed).

### `Note`
```
id          String    cuid
title       String    stored; auto-set to first non-empty line of content on save
content     String    markdown — supports inline checklists (- [ ] syntax)
createdAt   DateTime
updatedAt   DateTime
```
Checklist items in notes serve as tasks. No separate Task model. Jarvis reads all notes as context and can create or append to notes from chat.

### `JarvisMemory`
```
id          String    fixed value "default"
data        Json      structured memory blob (see Memory Schema below)
updatedAt   DateTime
```
Single row. Jarvis rewrites this after significant interactions (async, non-blocking). User can view and edit in the Memory section.

### `ChatMessage`
```
id          String    cuid
role        Enum      user | assistant
content     String
createdAt   DateTime
```

### `CalendarEvent` (local cache)
```
id          String    cuid
externalId  String    Apple Calendar UID (unique)
title       String
startAt     DateTime
endAt       DateTime
syncedAt    DateTime
```
Populated by the AppleScript bridge sync every 15 minutes. Read-only from the app's perspective — writes go back to Apple Calendar via AppleScript, not to this table.

### Memory JSON Schema
```json
{
  "goals": [
    {
      "title": "Learn Spanish",
      "horizon": "long_term",
      "target": "conversational by December 2026",
      "lastEngaged": "2026-05-20",
      "priority": "high"
    }
  ],
  "habits": [
    {
      "title": "Duolingo",
      "frequency": "daily",
      "lastMentioned": "2026-05-22"
    }
  ],
  "interests": ["guitar", "fitness", "building Jarvis"],
  "patterns": ["works better in evenings", "tends to procrastinate on creative tasks"],
  "keyFacts": ["building a startup", "learning guitar"],
  "preferences": {
    "briefingStyle": "concise bullets"
  }
}
```

---

## Intelligence Layer

### LLM
- OpenAI-compatible client (existing), configurable via `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`
- Web search enabled — model must support it (e.g. `gpt-4o` with web search, or Claude via Anthropic SDK)
- No approval gate — Jarvis acts directly and reports what it did inline

### Context on Every Call
1. Full `JarvisMemory` JSON
2. Last 20 chat messages
3. All notes, ordered by `updatedAt` descending, capped at a reasonable token limit (~50k tokens)
4. `CalendarEvent` rows for the next 7 days

### Memory Update Loop
After each conversation turn, Jarvis fires an async background LLM call (non-blocking) that receives the existing `JarvisMemory` JSON + the latest user/assistant exchange and returns an updated memory JSON. The prompt instructs the model to add new facts, update `lastEngaged` timestamps, and remove stale entries — but only make changes when something meaningful was said. The result overwrites `JarvisMemory.data`.

### Daily Brief Logic
Reads: upcoming task checklist items from notes + calendar events for today/this week + memory goals/habits sorted by `lastEngaged`. Surfaces 3–5 prioritized items, each with a one-line reason and a suggested next action. Nudges on anything not engaged with in 7+ days.

---

## UI

### Notes Client (Electron on Mac, PWA on phone)

Apple Notes layout: note list sidebar on the left, full editor on the right.

- Note list shows title + first line preview, sorted by `updatedAt` descending
- New note button at top of sidebar
- Editor: clean, minimal — free text with inline checklist support (`- [ ]` renders as a checkbox)
- No tags, folders, or formatting toolbar
- Responsive: full-screen editor on phone, list/editor split on Mac
- Jarvis can create notes and append to existing ones from the Jarvis PWA

### Jarvis Client (PWA)

Two tabs:

```
[ Jarvis ]  [ Memory ]
```

**Jarvis tab:** Full-width conversation interface. Chat and brief are merged — asking "what should I work on today?" is just a message.

- Message history scrolls up
- Input at the bottom
- Jarvis responses can include action confirmations inline: "I've blocked off Tuesday afternoon in your calendar and added a checklist to your Goals note."
- Brief is triggered by the user asking — no separate page or button

**Memory tab:** Editable view of `JarvisMemory`. Displayed as cards grouped by category (Goals, Habits, Interests, Key Facts, Patterns, Preferences). Each card is editable inline. User can add new entries or delete stale ones.

---

## Calendar Integration

Background sync only — no Calendar tab in the UI (user manages calendar in Apple Calendar).

- **Read:** sync Apple Calendar events into a local cache every 15 minutes via AppleScript bridge in Electron main process. Jarvis reads these when building context for the brief and conversations.
- **Write:** when user asks Jarvis to schedule something in chat, Jarvis calls the AppleScript bridge to create the event in Apple Calendar directly.
- **AppleScript bridge:** a small IPC handler in Electron main process that executes AppleScript to read/write Calendar.app events.

---

## What Changes From Current Codebase

| Current | New |
|---|---|
| Goals, Tasks, Reflections, SuggestedUpdates models | Removed |
| Approval flow (pending/approve/reject) | Removed — Jarvis acts directly |
| Dashboard, Goals, Tasks, Reflections pages | Removed |
| WhatNextPanel, PendingSuggestionsList components | Removed |
| SQLite schema via Prisma | New schema: Note, JarvisMemory, ChatMessage |
| Next.js web app in browser | Two clients: Notes (Electron on Mac + PWA on phone) + Jarvis (PWA) |
| Chat at /chat | Jarvis tab in Jarvis PWA (merged chat + brief) |
| No notes feature | Separate Notes app — Electron on Mac, PWA on phone (new) |
| Hidden DB memory context | Memory tab in Jarvis PWA (new, editable) |

---

## Out of Scope (Future)

- Voice interface
- Native phone app (Notes PWA becomes native)
- Smart home integrations (bulbs, alarms)
- Authentication / multi-user
- Notes PWA → native iOS app
