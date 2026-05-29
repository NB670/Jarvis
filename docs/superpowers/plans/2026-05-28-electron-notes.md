# Electron Notes App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the `/notes` Next.js page as a self-contained macOS `.app` using Electron and Next.js standalone output mode.

**Architecture:** Electron's main process uses `utilityProcess.fork()` (Electron's built-in Node.js runtime) to spawn the Next.js standalone server on a dynamically chosen free port. A template empty database is bundled as a resource and copied to `~/Library/Application Support/Jarvis/jarvis.db` on first launch. `electron-builder` packages everything (Electron + `.next/standalone/` + Prisma binaries + template DB) with `asar: false` for simplicity into a `.app` + `.dmg`. Dev mode skips server spawning and opens the already-running `next dev` server directly.

**Tech Stack:** Electron 33+, electron-builder, electron-store, Next.js 16 standalone output, Prisma 6 (native binary), concurrently, wait-on

---

## File Map

### Create
- `electron/main.js` — main process: port detection, DB setup, server spawn, window
- `electron/preload.js` — minimal preload (context isolation)
- `electron-builder.yml` — packaging config (`asar: false`, extraResources for prod.db)

### Modify
- `next.config.ts` — add `output: 'standalone'`
- `prisma/schema.prisma` — add `binaryTargets = ["native"]`
- `package.json` — add `"main"` field, scripts, and new dependencies
- `.gitignore` — ignore `dist/` and `prisma/prod.db`

---

## Task 1: Enable Next.js standalone output

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Replace `next.config.ts` with standalone config**

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
}

export default nextConfig
```

- [ ] **Step 2: Run production build and verify standalone output**

```bash
cd /Users/neelb/Documents/Jarvis && npm run build 2>&1 | tail -10
ls .next/standalone/
```

Expected: `server.js` and `node_modules/` appear in `.next/standalone/`.

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat: enable Next.js standalone output for Electron packaging"
```

---

## Task 2: Add Prisma native binary target

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `binaryTargets` to the generator block**

In `prisma/schema.prisma`, update the `generator` block to:

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native"]
}
```

- [ ] **Step 2: Regenerate the Prisma client**

```bash
cd /Users/neelb/Documents/Jarvis && npx prisma generate
```

Expected: `✔ Generated Prisma Client` with no errors.

- [ ] **Step 3: Verify tests still pass**

```bash
npm test
```

Expected: 18 tests pass.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add native binaryTarget to Prisma for Electron packaging"
```

---

## Task 3: Install Electron dependencies and update package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime dependency**

```bash
cd /Users/neelb/Documents/Jarvis && npm install electron-store
```

- [ ] **Step 2: Install dev dependencies**

```bash
npm install --save-dev electron electron-builder concurrently wait-on
```

- [ ] **Step 3: Add `"main"` field to `package.json`**

Open `package.json` and add `"main": "electron/main.js"` at the top level alongside `"name"` and `"version"`.

- [ ] **Step 4: Add scripts to `package.json`**

Add these two entries inside `"scripts"`:

```json
"electron:dev": "concurrently \"next dev\" \"wait-on http://localhost:3000 && electron .\"",
"electron:build": "next build && (cp -r public .next/standalone/public 2>/dev/null || true) && cp -r .next/static .next/standalone/.next/static && DATABASE_URL=file:./prisma/prod.db npx prisma migrate deploy && electron-builder"
```

- [ ] **Step 5: Verify Electron installed correctly**

```bash
npx electron --version
```

Expected: prints a version like `v33.x.x`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install Electron dependencies and add build scripts"
```

---

## Task 4: Create preload script

**Files:**
- Create: `electron/preload.js`

- [ ] **Step 1: Create `electron/preload.js`**

```js
'use strict'
// Minimal context-isolation preload — no IPC needed, app uses HTTP API routes
const { contextBridge } = require('electron')
contextBridge.exposeInMainWorld('isElectron', true)
```

- [ ] **Step 2: Commit**

```bash
git add electron/preload.js
git commit -m "feat: add Electron preload script"
```

---

## Task 5: Create Electron main process

**Files:**
- Create: `electron/main.js`

- [ ] **Step 1: Create `electron/main.js`**

```js
'use strict'

const { app, BrowserWindow, utilityProcess } = require('electron')
const path = require('path')
const fs = require('fs')
const net = require('net')
const http = require('http')

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let mainWindow = null
let nextProcess = null

// ── Paths ──────────────────────────────────────────────────────────────────

function getDbPath() {
  return path.join(app.getPath('userData'), 'jarvis.db')
}

function getStandaloneDir() {
  // asar: false → files live at resources/app/
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app', '.next', 'standalone')
    : path.join(__dirname, '..', '.next', 'standalone')
}

// ── Port detection ─────────────────────────────────────────────────────────

function findFreePort(start) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.unref()
    server.on('error', () => resolve(findFreePort(start + 1)))
    server.listen(start, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

// ── Database (production only) ─────────────────────────────────────────────

function ensureDatabase() {
  const dbPath = getDbPath()
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  if (!fs.existsSync(dbPath)) {
    // Copy the bundled empty template DB on first launch
    const template = path.join(process.resourcesPath, 'prod.db')
    if (fs.existsSync(template)) {
      fs.copyFileSync(template, dbPath)
    }
  }

  process.env.DATABASE_URL = `file:${dbPath}`
}

// ── Next.js server (production only) ──────────────────────────────────────

function startServer(port) {
  const serverPath = path.join(getStandaloneDir(), 'server.js')

  // utilityProcess.fork uses Electron's bundled Node.js — no system node required
  nextProcess = utilityProcess.fork(serverPath, [], {
    cwd: getStandaloneDir(),
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
    },
  })
}

function waitForServer(port, retries = 60) {
  return new Promise((resolve, reject) => {
    function attempt(n) {
      if (n === 0) return reject(new Error(`Next.js server did not start on port ${port}`))
      const req = http.get(`http://127.0.0.1:${port}`, () => resolve())
      req.on('error', () => setTimeout(() => attempt(n - 1), 500))
      req.end()
    }
    attempt(retries)
  })
}

// ── Window ─────────────────────────────────────────────────────────────────

function createWindow(port) {
  const Store = require('electron-store')
  const store = new Store({ name: 'window-state' })
  const saved = store.get('bounds', { width: 1100, height: 720 })

  mainWindow = new BrowserWindow({
    width: saved.width,
    height: saved.height,
    x: saved.x,
    y: saved.y,
    minWidth: 700,
    minHeight: 500,
    title: 'Notes',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadURL(`http://127.0.0.1:${port}/notes`)

  mainWindow.on('close', () => {
    if (mainWindow) store.set('bounds', mainWindow.getBounds())
  })
  mainWindow.on('closed', () => { mainWindow = null })
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  if (app.isPackaged) {
    // Production: spawn the bundled standalone Next.js server
    ensureDatabase()
    const port = await findFreePort(3000)
    startServer(port)
    await waitForServer(port)
    createWindow(port)
  } else {
    // Dev: next dev is already running (started by concurrently + wait-on in electron:dev)
    createWindow(3000)
  }
})

app.on('window-all-closed', () => app.quit())

app.on('will-quit', () => {
  if (nextProcess) {
    nextProcess.kill()
    nextProcess = null
  }
})
```

- [ ] **Step 2: Commit**

```bash
git add electron/main.js
git commit -m "feat: Electron main process — DB setup, standalone server, window management"
```

---

## Task 6: Create electron-builder configuration

**Files:**
- Create: `electron-builder.yml`
- Create: `electron/assets/` (placeholder icon)

- [ ] **Step 1: Create `electron/assets/` and a placeholder icon**

```bash
mkdir -p electron/assets
# Copy a macOS system icon as a placeholder (replace before distributing)
cp /System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/GenericDocumentIcon.icns \
  electron/assets/icon.icns 2>/dev/null && echo "Icon copied" || echo "Note: add electron/assets/icon.icns before distributing"
```

- [ ] **Step 2: Create `electron-builder.yml`**

```yaml
appId: com.jarvis.notes
productName: Notes
copyright: "Copyright © 2026"

asar: false

directories:
  output: dist

files:
  - "electron/**"
  - ".next/standalone/**"
  - "!**/.git/**"
  - "!**/node_modules/.cache/**"

extraResources:
  - from: "prisma/prod.db"
    to: "prod.db"

mac:
  category: public.app-category.productivity
  target:
    - target: dmg
      arch:
        - universal
  minimumSystemVersion: "13.0"
  # icon: electron/assets/icon.icns  # Uncomment after adding icon.icns

dmg:
  title: "Notes"
  contents:
    - x: 130
      y: 220
    - x: 410
      y: 220
      type: link
      path: /Applications
```

- [ ] **Step 3: If the icon was copied successfully, uncomment the `icon:` line in `electron-builder.yml`**

```bash
ls electron/assets/icon.icns 2>/dev/null && \
  sed -i '' 's/  # icon:/  icon:/' electron-builder.yml && \
  echo "Icon enabled in config" || echo "No icon — using Electron default"
```

- [ ] **Step 4: Commit**

```bash
git add electron-builder.yml electron/assets/
git commit -m "feat: electron-builder packaging config"
```

---

## Task 7: Update .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add Electron build output and prod.db to .gitignore**

Append to `.gitignore`:

```
# Electron build output
dist/
prisma/prod.db
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore Electron build output and prod.db"
```

---

## Task 8: Test development mode

**Files:** none (verification only)

- [ ] **Step 1: Start in dev mode**

```bash
cd /Users/neelb/Documents/Jarvis && npm run electron:dev
```

Expected: Next.js dev server starts on port 3000, then an Electron window opens showing the Notes page. Both the sidebar and editor should be visible and functional.

- [ ] **Step 2: Verify Notes functionality works**

In the Electron window:
- Sidebar shows existing notes (or empty state)
- Clicking "+" creates a new note
- Typing in the editor auto-saves after 800ms (title updates in sidebar)

- [ ] **Step 3: Quit and verify clean shutdown**

Close the Electron window. Both the Electron process and the Next.js dev server should terminate. If either hangs, Ctrl+C kills them.

---

## Task 9: Build and test the `.app` bundle

**Files:** none (build + verification only)

- [ ] **Step 1: Run the production build**

```bash
cd /Users/neelb/Documents/Jarvis && npm run electron:build 2>&1 | tail -60
```

Expected output (in order):
1. `✓ Compiled successfully` (Next.js build)
2. `prisma/prod.db` created by `prisma migrate deploy`
3. electron-builder packages the app
4. `• building target=dmg` or `• building target=app`

If the build fails, read the full error output and fix before continuing.

- [ ] **Step 2: Verify build output**

```bash
ls dist/mac-universal/ 2>/dev/null || ls dist/mac/ 2>/dev/null || ls dist/
```

Expected: `Notes.app` and `Notes.dmg` are present.

- [ ] **Step 3: Launch the packaged app**

```bash
open "dist/mac-universal/Notes.app" 2>/dev/null || open "dist/mac/Notes.app" 2>/dev/null
```

Expected: the Notes app opens in a new window with the macOS traffic lights visible.

- [ ] **Step 4: Smoke test the packaged app**

Verify all of these work in the packaged app:
1. Notes sidebar is visible on the left
2. Create a new note with "+" — it appears in the sidebar
3. Type content in the editor — it saves (title updates)
4. Quit and reopen the app — the note persists

- [ ] **Step 5: Commit any fixes made during build/test**

If fixes were needed to make the build or smoke test pass, commit them:

```bash
git add -A
git commit -m "fix: resolve Electron build issues"
```

If no fixes needed, skip this step.
