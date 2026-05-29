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
    title: 'Notes',
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
  } else {
    // Dev: next dev is already running on port 3737 (started by concurrently + wait-on in electron:dev)
    createWindow(3737)
  }
})

app.on('window-all-closed', () => app.quit())

app.on('will-quit', () => {
  if (nextProcess) {
    nextProcess.kill()
    nextProcess = null
  }
})
