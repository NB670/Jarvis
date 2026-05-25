# Jarvis Redesign — Design Spec

**Date:** 2026-05-25
**Status:** Approved

## Overview

Jarvis is a personal AI planning partner — a macOS desktop app (Electron) with three sections: Notes, Jarvis (chat + daily brief), and Memory. It understands your goals, tracks what you've been neglecting, and holds full planning conversations with internet access. All inputs (notes, chat, voice later) feed a structured memory core that Jarvis maintains and uses as context on every interaction.

The guiding principle: **Jarvis knows you.** Notes and chat are just different ways to communicate with it. The memory is what persists and grows.

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

### macOS App (Electron)

- **Main process:** manages the window, system tray popover, Apple Calendar sync via AppleScript bridge, native notifications
- **Renderer:** Next.js app running inside the Electron window — no browser needed
- **System tray:** small Jarvis icon in the menu bar; click → popover for quick queries and daily brief without opening the full window

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

### Navigation
Three tabs at the top of the window:

```
[ Notes ]  [ Jarvis ]  [ Memory ]
```

### Notes Tab
Apple Notes layout: note list sidebar on the left, full editor on the right.

- Note list shows title + first line preview, sorted by `updatedAt` descending
- New note button at top of sidebar
- Editor: clean, minimal — free text with inline checklist support (`- [ ]` renders as a checkbox)
- No tags, folders, or formatting toolbar — keep it simple
- Jarvis can create notes and append to existing ones from chat

### Jarvis Tab
Full-width conversation interface. Chat and brief are merged — asking "what should I work on today?" is just a message.

- Message history scrolls up
- Input at the bottom
- Jarvis responses can include action confirmations inline: "I've blocked off Tuesday afternoon in your calendar and added a checklist to your Goals note."
- Brief is triggered by the user asking — no separate page or button

### Memory Tab
Editable view of `JarvisMemory`. Displayed as cards grouped by category (Goals, Habits, Interests, Key Facts, Patterns, Preferences). Each card is editable inline. User can add new entries or delete stale ones.

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
| Next.js web app in browser | Electron wrapper added |
| Chat at /chat | Jarvis tab (merged chat + brief) |
| No notes feature | Notes tab (new) |
| Hidden DB memory context | Memory tab (new, editable) |

---

## Out of Scope (Future)

- Voice interface
- Phone app
- Smart home integrations (bulbs, alarms)
- Multi-device sync
- Authentication / multi-user
