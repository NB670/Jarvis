# Electron Notes App — Design Spec

**Date:** 2026-05-28
**Goal:** Package the existing `/notes` Next.js page as a standalone macOS `.app` using Electron.

---

## Overview

Wrap the existing Notes PWA (`/notes`) in an Electron shell that:
- Runs as a proper macOS `.app` (drag to `/Applications`)
- Spawns the Next.js server internally and opens it in a BrowserWindow
- Stores the SQLite database in `~/Library/Application Support/Jarvis/`
- Matches Mac Notes' two-panel structural layout using the existing zinc/gray color scheme

The existing Next.js app, components, API routes, and Prisma schema are **unchanged**.

---

## Architecture

### Electron Layer (new)

```
electron/
  main.ts          — main process: DB setup, server spawn, window management
  preload.ts       — minimal context isolation preload
  assets/
    icon.icns      — macOS app icon (placeholder, replaceable)
electron-builder.yml — packaging config
```

### Main Process Flow

On every launch, `electron/main.ts`:

1. Sets `DATABASE_URL=file:<userData>/jarvis.db` (where `<userData>` = `~/Library/Application Support/Jarvis/`)
2. Runs `npx prisma migrate deploy` against that DB path (no-op if up to date)
3. Finds a free port (starting from 3000) using `detect-port`
4. Spawns `next start -p <port>` as a child process
5. Polls `http://localhost:<port>` with `wait-on` until the server is ready
6. Opens a `BrowserWindow` at `http://localhost:<port>/notes`
6. Kills the child process on app quit

### Preload

Minimal — context isolation only. No IPC needed: the renderer communicates with the backend via HTTP (the existing API routes).

---

## Window

| Property | Value |
|---|---|
| Frame | Standard macOS (traffic lights visible) |
| Default size | 1100 × 720 |
| Minimum size | 700 × 500 |
| Resizable | Yes |
| Title | "Notes" |
| Close behavior | Quit app |
| Window state | Position + size persisted via `electron-store` |

No changes to the Notes UI components. The existing two-panel layout (NoteList sidebar + NoteEditor) matches Mac Notes' structural layout.

---

## Database

| Context | Path |
|---|---|
| Development | `./prisma/dev.db` (unchanged) |
| Packaged app | `~/Library/Application Support/Jarvis/jarvis.db` |

On first launch, `prisma migrate deploy` creates the DB from scratch. On subsequent launches it's a fast no-op. App updates preserve user data since the DB lives outside the bundle.

---

## Build & Packaging

### New Scripts

```json
"electron:dev":   "concurrently \"next dev\" \"wait-on http://localhost:3000 && electron .\"",
"electron:build": "next build && electron-builder"
```

### New Dependencies

| Package | Type | Purpose |
|---|---|---|
| `electron` | devDependency | Electron runtime |
| `electron-builder` | devDependency | `.app` / `.dmg` packager |
| `concurrently` | devDependency | Run Next.js + Electron in parallel for dev |
| `wait-on` | devDependency | Wait for Next.js server before opening window |
| `detect-port` | dependency | Find a free port to avoid conflicts with other processes |
| `electron-store` | dependency | Persist window position/size |

### Output

- `dist/mac/Jarvis.app` — drag-to-Applications bundle
- `dist/Jarvis.dmg` — installer disk image

### What Gets Bundled

- Electron runtime
- `.next/` production build
- `node_modules/` (pruned to production deps)
- Prisma client + query engine binary (macOS arm64/x64)
- `prisma/migrations/` (for `migrate deploy`)

---

## Out of Scope

- Code signing / notarization (needed for distribution outside the team — separate step)
- Auto-update (separate plan)
- Menu bar / system tray mode
- Touch Bar support
