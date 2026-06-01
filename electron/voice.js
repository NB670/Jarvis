'use strict'

const { ipcMain, BrowserWindow, screen } = require('electron')
const { spawn } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

// ── Audio utils ───────────────────────────────────────────────────────────────

function buildWav(samples, sampleRate = 16000) {
  const n = samples.length
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0, 'ascii')
  buf.writeUInt32LE(36 + n * 2, 4)
  buf.write('WAVE', 8, 'ascii')
  buf.write('fmt ', 12, 'ascii')
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36, 'ascii')
  buf.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) buf.writeInt16LE(samples[i], 44 + i * 2)
  return buf
}

function computeRms(frame) {
  if (!frame.length) return 0
  const sumSq = frame.reduce((a, s) => a + s * s, 0)
  return Math.sqrt(sumSq / frame.length)
}

// ── OpenAI helpers ────────────────────────────────────────────────────────────

async function transcribe(wavBuf, apiKey) {
  const blob = new Blob([wavBuf], { type: 'audio/wav' })
  const form = new FormData()
  form.append('file', blob, 'audio.wav')
  form.append('model', 'whisper-1')
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })
  if (!res.ok) throw new Error(`Whisper error ${res.status}`)
  const json = await res.json()
  return (json.text || '').trim()
}

async function speak(text, apiKey) {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-1', voice: 'onyx', input: text }),
  })
  if (!res.ok) throw new Error(`TTS error ${res.status}`)
  const mp3 = path.join(os.tmpdir(), `jarvis-tts-${Date.now()}.mp3`)
  fs.writeFileSync(mp3, Buffer.from(await res.arrayBuffer()))
  await new Promise((resolve, reject) => {
    const proc = spawn('afplay', [mp3])
    proc.on('close', () => { try { fs.unlinkSync(mp3) } catch {} resolve() })
    proc.on('error', reject)
  })
}

// ── Chat ──────────────────────────────────────────────────────────────────────

async function sendChat(message, conversationId, port) {
  const res = await fetch(`http://localhost:${port}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, conversationId }),
  })
  if (!res.ok) throw new Error(`Chat error ${res.status}`)
  return res.json() // { message, conversationId, endSession }
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

// ── Recording ─────────────────────────────────────────────────────────────────

const SILENCE_THRESHOLD = 500    // RMS below this = silence
const SILENCE_FRAMES_NEEDED = 47 // ~1.5s at 16kHz / 512 frame length
const SESSION_TIMEOUT_MS = 30000 // end session if silent for 30s

async function recordUntilSilence(pvRecorder) {
  const allSamples = []
  let silentFrames = 0
  let hasSpoken = false
  const silenceStart = Date.now()

  while (true) {
    if (!sessionActive) return null // session ended externally (X button, IPC)
    const frame = pvRecorder.read()
    const rms = computeRms(frame)

    if (rms >= SILENCE_THRESHOLD) {
      hasSpoken = true
    }

    if (!hasSpoken && Date.now() - silenceStart > SESSION_TIMEOUT_MS) {
      return null // user never spoke — end session
    }

    if (hasSpoken) {
      for (const s of frame) allSamples.push(s)
      if (rms < SILENCE_THRESHOLD) {
        silentFrames++
        if (silentFrames >= SILENCE_FRAMES_NEEDED) break
      } else {
        silentFrames = 0
      }
    }
  }

  return new Int16Array(allSamples)
}

// ── Session ───────────────────────────────────────────────────────────────────

let overlayWindow = null
let sessionActive = false
let appPort = null
let porcupine = null
let pvRecorder = null

function sendToOverlay(event, data) {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send(event, data)
  }
}

function createOverlay(port) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  overlayWindow = new BrowserWindow({
    width: 290,
    height: 340,
    x: width - 310,
    y: height - 360,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  overlayWindow.loadURL(`http://localhost:${port}/voice`)
  overlayWindow.on('closed', () => { overlayWindow = null })
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

  createOverlay(appPort)

  // Drain a few frames to skip the wake word utterance
  const drainFrames = Math.ceil(0.3 * 16000 / porcupine.frameLength)
  for (let i = 0; i < drainFrames; i++) pvRecorder.read()

  sendToOverlay('voice:state', { state: 'listening' })

  // Turn loop
  while (sessionActive) {
    const samples = await recordUntilSilence(pvRecorder)

    if (!samples) {
      // 30s timeout — no speech
      break
    }

    sendToOverlay('voice:state', { state: 'thinking', userText: '…' })

    let userText, reply, shouldEndSession
    try {
      userText = await transcribe(buildWav(samples), apiKey)
      if (!userText) { sendToOverlay('voice:state', { state: 'listening' }); continue }

      sendToOverlay('voice:state', { state: 'thinking', userText })

      const result = await sendChat(userText, conversationId, appPort)
      reply = result.message
      shouldEndSession = result.endSession
      conversationId = result.conversationId
    } catch (e) {
      console.error('[voice] Turn error:', e.message)
      sendToOverlay('voice:state', { state: 'listening' })
      continue
    }

    sendToOverlay('voice:state', { state: 'speaking', replyText: reply })

    try {
      await speak(reply, apiKey)
    } catch (e) {
      console.error('[voice] TTS error (text-only fallback):', e.message)
    }

    if (shouldEndSession) break
    sendToOverlay('voice:state', { state: 'listening' })
  }

  endSession()
}

function endSession() {
  sessionActive = false
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close()
  }
}

// ── Wake word loop ────────────────────────────────────────────────────────────

function startWakeWordLoop() {
  function tick() {
    if (!pvRecorder || !porcupine) return
    try {
      const frame = pvRecorder.read()
      const idx = porcupine.process(frame)
      if (idx >= 0 && !sessionActive) {
        startSession().catch((e) => {
          console.error('[voice] Session error:', e.message)
          sessionActive = false
        })
      }
    } catch (e) {
      console.error('[voice] Wake word loop error:', e.message)
    }
    setImmediate(tick)
  }
  setImmediate(tick)
}

// ── Public API ────────────────────────────────────────────────────────────────

async function startVoiceEngine(port) {
  appPort = port

  const accessKey = process.env.PORCUPINE_ACCESS_KEY
  if (!accessKey) {
    console.log('[voice] PORCUPINE_ACCESS_KEY not set — voice disabled')
    return
  }

  ipcMain.on('voice:close', () => endSession())

  try {
    const { Porcupine, BuiltinKeyword } = require('@picovoice/porcupine-node')
    const { PvRecorder } = require('@picovoice/pvrecorder-node')

    porcupine = new Porcupine(accessKey, [BuiltinKeyword.JARVIS], [0.5])
    pvRecorder = new PvRecorder(porcupine.frameLength)
    pvRecorder.start()

    startWakeWordLoop()
    console.log('[voice] Wake word listener started — say "Jarvis"')
  } catch (e) {
    console.error('[voice] Failed to start voice engine:', e.message)
  }
}

function stopVoiceEngine() {
  if (pvRecorder) { try { pvRecorder.stop() } catch {} pvRecorder = null }
  if (porcupine) { try { porcupine.release() } catch {} porcupine = null }
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.close()
}

module.exports = { startVoiceEngine, stopVoiceEngine }
