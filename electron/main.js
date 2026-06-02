'use strict'

// Load .env into process.env for dev mode (Next.js does this for the server
// but the Electron main process needs it too, e.g. for OPENAI_API_KEY)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })

const { app, BrowserWindow, utilityProcess } = require('electron')
const path = require('path')
const fs = require('fs')
const net = require('net')
const http = require('http')
const { startVoiceEngine, stopVoiceEngine } = require('./voice')

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
          "reminderId" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX "DailyTask_date_idx" ON "DailyTask"("date");
      `)
    } else {
      const taskCols = db.prepare('PRAGMA table_info(DailyTask)').all()
      if (!taskCols.find((c) => c.name === 'type')) {
        db.exec(`ALTER TABLE "DailyTask" ADD COLUMN "type" TEXT DEFAULT 'block'`)
        db.exec(`UPDATE "DailyTask" SET "type" = 'block' WHERE "type" IS NULL`)
      }
      if (!taskCols.find((c) => c.name === 'reminderId')) {
        db.exec(`ALTER TABLE "DailyTask" ADD COLUMN "reminderId" TEXT`)
      }
    }
  } catch (e) {
    console.error('Migration error:', e)
    throw e
  } finally {
    db.close()
  }
}

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

  try {
    applyMigrations(dbPath)
  } catch (e) {
    app.quit()
    return
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
      DATABASE_URL: process.env.DATABASE_URL, // ensure standalone .env cannot override
    },
  })
}

function waitForServer(port, retries = 60) {
  return new Promise((resolve, reject) => {
    function attempt(n) {
      if (n === 0) return reject(new Error(`Next.js server did not start on port ${port}`))
      const req = http.get(`http://localhost:${port}`, () => resolve())
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
    title: 'Jnotes',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadURL(`http://localhost:${port}/notes`)

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
    startVoiceEngine(port)
  } else {
    // Dev: next dev is already running on port 3737 (started by concurrently + wait-on in electron:dev)
    createWindow(3737)
    startVoiceEngine(3737)
  }
})

app.on('window-all-closed', () => app.quit())

app.on('will-quit', () => {
  stopVoiceEngine()
  if (nextProcess) {
    nextProcess.kill()
    nextProcess = null
  }
})
