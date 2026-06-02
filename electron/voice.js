'use strict'

const { ipcMain, BrowserWindow, screen } = require('electron')
const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

// ── OpenAI helpers ────────────────────────────────────────────────────────────

async function speak(text, apiKey) {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-1', voice: 'nova', input: text }),
  })
  if (!res.ok) throw new Error(`TTS error ${res.status}`)
  const mp3 = path.join(os.tmpdir(), `jarvis-tts-${Date.now()}.mp3`)
  fs.writeFileSync(mp3, Buffer.from(await res.arrayBuffer()))
  await new Promise((resolve, reject) => {
    const proc = spawn('afplay', [mp3])
    proc.on('close', () => { try { fs.unlinkSync(mp3) } catch {} resolve() })
    proc.on('error', (err) => { try { fs.unlinkSync(mp3) } catch {} reject(err) })
  })
}

// ── Chat ──────────────────────────────────────────────────────────────────────

async function sendChat(message, conversationId, port) {
  const res = await fetch(`http://localhost:${port}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, conversationId, voice: true }),
  })
  if (!res.ok) throw new Error(`Chat error ${res.status}`)
  return res.json()
}

async function createConversation(port) {
  const res = await fetch(`http://localhost:${port}/api/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`Conversations error ${res.status}`)
  const json = await res.json()
  return json.id
}

// ── Session ───────────────────────────────────────────────────────────────────

let sessionActive = false
let appPort = null
let wakeProcess = null

// Resolves each time Python sends a TEXT:<text> line (or null for SESSION_DONE)
let textResolve = null

function onPythonLine(line) {
  if (line === 'WAKE' && !sessionActive) {
    startSession().catch((e) => {
      console.error('[voice] Session error:', e.message)
      sessionActive = false
    })
  } else if (line.startsWith('TEXT:') && sessionActive) {
    if (textResolve) { textResolve(line.slice(5)); textResolve = null }
  } else if (line === 'SESSION_DONE' && sessionActive) {
    if (textResolve) { textResolve(null); textResolve = null }
    endSession()
  }
}

function waitForText() {
  return new Promise((resolve) => { textResolve = resolve })
}

async function startSession() {
  if (sessionActive) return
  sessionActive = true

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('[voice] OPENAI_API_KEY not set')
    sessionActive = false
    return
  }

  let conversationId
  try {
    conversationId = await createConversation(appPort)
  } catch (e) {
    console.error('[voice] Failed to create conversation:', e.message)
    sessionActive = false
    return
  }

  console.log('[voice] Session started — listening')

  while (sessionActive) {
    const userText = await waitForText()
    if (!userText) break  // SESSION_DONE from Python

    console.log(`[voice] You: ${userText}`)

    let reply, shouldEndSession
    try {
      const result = await sendChat(userText, conversationId, appPort)
      reply = result.message
      shouldEndSession = result.endSession
      conversationId = result.conversationId
      console.log(`[voice] Jarvis: ${reply}`)
    } catch (e) {
      console.error('[voice] Chat error:', e.message)
      wakeProcess?.stdin.write('READY\n')
      continue
    }

    try {
      await speak(reply, apiKey)
    } catch (e) {
      console.error('[voice] TTS error:', e.message)
    }

    if (shouldEndSession) {
      wakeProcess?.stdin.write('END\n')
      break
    }

    wakeProcess?.stdin.write('READY\n')
  }

  endSession()
}

function endSession() {
  if (!sessionActive) return
  sessionActive = false
  if (textResolve) { textResolve(null); textResolve = null }
  console.log('[voice] Session ended')
}

// ── Wake word process ─────────────────────────────────────────────────────────

let lineBuffer = ''

function startWakeWordProcess() {
  const scriptPath = path.join(__dirname, 'wake_word.py')
  wakeProcess = spawn('python3.12', [scriptPath], {
    env: { ...process.env },
  })

  wakeProcess.stdout.on('data', (chunk) => {
    lineBuffer += chunk.toString()
    let nl
    while ((nl = lineBuffer.indexOf('\n')) !== -1) {
      const line = lineBuffer.slice(0, nl).trim()
      lineBuffer = lineBuffer.slice(nl + 1)
      if (line) onPythonLine(line)
    }
  })

  wakeProcess.stderr.on('data', (data) => process.stderr.write(data))

  wakeProcess.on('exit', (code, signal) => {
    wakeProcess = null
    if (code !== 0 && signal !== 'SIGTERM') {
      console.error(`[wake] Python process exited with code ${code}`)
    }
  })
}

// ── Public API ────────────────────────────────────────────────────────────────

async function startVoiceEngine(port) {
  appPort = port

  ipcMain.removeAllListeners('voice:close')
  ipcMain.on('voice:close', () => endSession())

  startWakeWordProcess()
  console.log("[voice] Wake word listener started — say 'Hey Jarvis'")
}

function stopVoiceEngine() {
  if (wakeProcess) { try { wakeProcess.kill() } catch {} wakeProcess = null }
}

module.exports = { startVoiceEngine, stopVoiceEngine }
