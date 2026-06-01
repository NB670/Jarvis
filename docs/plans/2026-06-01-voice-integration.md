# Voice Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add always-on "Jarvis" wake word detection with voice input, LLM chat, and text-to-speech output via a floating transparent Electron overlay window.

**Architecture:** Porcupine wake word runs continuously in the Electron main process (~1% CPU). On detection: pvrecorder captures audio → Whisper STT → existing `/api/chat` → OpenAI TTS → `afplay`. A frameless transparent `BrowserWindow` at `/voice` shows the live transcript and animated state indicators.

**Tech Stack:** `@picovoice/porcupine-node`, `@picovoice/pvrecorder-node`, OpenAI Whisper (`whisper-1`), OpenAI TTS (`tts-1`, voice `onyx`), macOS `afplay`

---

## File Map

| Action | File | What changes |
|---|---|---|
| Modify | `src/lib/llm/prompts/system.ts` | Add `[END_SESSION]` instruction |
| Modify | `src/lib/jarvis/chat-service.ts` | Strip `[END_SESSION]`, return `endSession` flag |
| Create | `src/lib/voice/utils.ts` | Pure functions: `buildWav`, `computeRms` |
| Create | `tests/voice/utils.test.ts` | Tests for pure functions |
| Create | `src/app/voice/page.tsx` | Next.js route for overlay (transparent, no chrome) |
| Create | `src/components/voice/VoiceOverlay.tsx` | Overlay UI: states, transcript, animations |
| Modify | `electron/preload.js` | Expose `voiceAPI` IPC bridge to renderer |
| Create | `electron/voice.js` | Full voice engine: Porcupine, recorder, Whisper, TTS, session |
| Modify | `electron/main.js` | Start voice engine on ready, pass port |

---

### Task 1: Install packages, add env var, update system prompt

**Files:**
- Modify: `src/lib/llm/prompts/system.ts`
- Modify: `.env` (or `.env.local` if it exists)

- [ ] **Step 1: Install Picovoice packages**

```bash
npm install @picovoice/porcupine-node @picovoice/pvrecorder-node
```

Expected: packages install without errors. These ship pre-built binaries for macOS — no node-gyp needed.

- [ ] **Step 2: Add PORCUPINE_ACCESS_KEY to env**

Add to `.env` (create if it doesn't exist alongside `.env.local`):

```bash
# Get your free key at https://console.picovoice.ai
PORCUPINE_ACCESS_KEY=
```

- [ ] **Step 3: Verify packages load**

```bash
node -e "const p = require('@picovoice/porcupine-node'); console.log('ok', Object.keys(p))"
```

Expected output: `ok [ 'Porcupine', 'BuiltinKeyword', ... ]`

- [ ] **Step 4: Update system prompt to add [END_SESSION] instruction**

In `src/lib/llm/prompts/system.ts`, add one sentence to the end of the prompt body (before the closing backtick):

```ts
export function jarvisChatSystemPrompt(): string {
  return `You are Jarvis, a personal planning partner and life coach. You know the user deeply through their notes and memory.

Personality: Direct, thoughtful, practical. Never sycophantic. Bias toward the smallest actionable next step. Honest about what you don't know.

Capabilities:
- Hold full planning conversations — strategy, prioritisation, brainstorming
- Answer questions using web_search when current information is needed
- Create and update notes in the user's notes app
- Plan the user's day by scheduling tasks with set_daily_tasks (syncs to Apple Calendar "Jarvis")
- Set reminders and deadlines with set_reminder (syncs to Apple Reminders "Jarvis" list)
- Update what you know about the user (goals, habits, patterns)

When you act on the user's data, describe what you did inline in your response (e.g. "I've added that to your Goals note." or "I've scheduled 4 tasks for today in your calendar.").

You have access to the user's notes, goals, habits, calendar, today's tasks, reminders, and memory context — use them actively.

When planning, ALWAYS factor in upcoming deadlines and reminders — surface them proactively, mention urgency, and schedule around them. If the user asks "what are my upcoming deadlines" or similar, list everything from REMINDERS & DEADLINES. If something is overdue or due soon, bring it up unprompted when it's relevant.

Output: plain conversational text (you may use markdown bullets when listing things). Do NOT wrap your response in JSON.

When the user's message signals the end of the conversation (goodbye, thanks, that's all, see you, etc.), end your reply with exactly: [END_SESSION]`
}
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/llm/prompts/system.ts
git commit -m "feat: install porcupine packages, add END_SESSION to system prompt"
```

---

### Task 2: Update chat service to strip [END_SESSION]

**Files:**
- Modify: `src/lib/jarvis/chat-service.ts`

The LLM will now sometimes include `[END_SESSION]` in its reply. Strip it before saving to the DB and return an `endSession` flag so the voice engine knows to close the session.

- [ ] **Step 1: Update runJarvisChat to strip marker and return endSession flag**

Replace the current `chat-service.ts` with:

```ts
import { appendChatMessages, createConversation, getRecentChatMessages, updateConversationTitle } from '@/lib/db'
import { chat } from '@/lib/llm/client'
import { buildContext } from './context-builder'
import { updateMemoryAsync } from './memory-service'
import { jarvisTools, handleJarvisToolCall } from './tools'

export async function runJarvisChat(userText: string, imageDataUrls: string[] = [], conversationId?: string) {
  let convId = conversationId
  if (!convId) {
    const conv = await createConversation()
    convId = conv.id
  }

  const userContent = imageDataUrls.length
    ? [
        { type: 'text' as const, text: userText },
        ...imageDataUrls.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
      ]
    : userText

  const ctx = await buildContext([{ role: 'user', content: userContent }], convId)

  const rawReply = await chat(ctx.messages, {
    extraTools: jarvisTools.map((t) => t.definition),
    onExtraToolCall: handleJarvisToolCall,
  })

  const endSession = rawReply.includes('[END_SESSION]')
  const reply = rawReply.replace(/\[END_SESSION\]/g, '').trim()

  await appendChatMessages([
    { role: 'user', content: userText },
    { role: 'assistant', content: reply },
  ], convId)

  if (!conversationId) {
    updateConversationTitle(convId, userText.slice(0, 60).trim()).catch(() => {})
  } else {
    const existing = await getRecentChatMessages(2, convId)
    if (existing.length <= 2) {
      updateConversationTitle(convId, userText.slice(0, 60).trim()).catch(() => {})
    }
  }

  updateMemoryAsync(ctx.memory, userText, reply)

  return { message: reply, conversationId: convId, endSession }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/jarvis/chat-service.ts
git commit -m "feat: strip [END_SESSION] marker from chat replies, return endSession flag"
```

---

### Task 3: Voice utility functions + tests

**Files:**
- Create: `src/lib/voice/utils.ts`
- Create: `tests/voice/utils.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/voice/utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildWav, computeRms } from '@/lib/voice/utils'

describe('buildWav', () => {
  it('writes RIFF/WAVE headers', () => {
    const samples = new Int16Array([100, -200, 300])
    const buf = buildWav(samples, 16000)
    expect(buf.slice(0, 4).toString('ascii')).toBe('RIFF')
    expect(buf.slice(8, 12).toString('ascii')).toBe('WAVE')
    expect(buf.slice(12, 16).toString('ascii')).toBe('fmt ')
    expect(buf.slice(36, 40).toString('ascii')).toBe('data')
  })

  it('encodes sample rate correctly', () => {
    const buf = buildWav(new Int16Array(10), 16000)
    expect(buf.readUInt32LE(24)).toBe(16000)
  })

  it('has correct total length', () => {
    const samples = new Int16Array(100)
    const buf = buildWav(samples, 16000)
    expect(buf.length).toBe(44 + 100 * 2)
  })

  it('writes sample data after header', () => {
    const samples = new Int16Array([1, -1])
    const buf = buildWav(samples, 16000)
    expect(buf.readInt16LE(44)).toBe(1)
    expect(buf.readInt16LE(46)).toBe(-1)
  })
})

describe('computeRms', () => {
  it('returns 0 for silence', () => {
    expect(computeRms(new Int16Array(512))).toBe(0)
  })

  it('returns correct RMS for constant signal', () => {
    const frame = new Int16Array(4).fill(1000)
    expect(computeRms(frame)).toBeCloseTo(1000)
  })

  it('returns value above threshold for loud signal', () => {
    const loud = new Int16Array(512).fill(2000)
    expect(computeRms(loud)).toBeGreaterThan(500)
  })

  it('returns value below threshold for near-silence', () => {
    const quiet = new Int16Array(512).fill(100)
    expect(computeRms(quiet)).toBeLessThan(500)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npx vitest run tests/voice/utils.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/voice/utils'`

- [ ] **Step 3: Implement utils**

Create `src/lib/voice/utils.ts`:

```ts
export function buildWav(samples: Int16Array, sampleRate = 16000): Buffer {
  const numSamples = samples.length
  const buf = Buffer.alloc(44 + numSamples * 2)
  buf.write('RIFF', 0, 'ascii')
  buf.writeUInt32LE(36 + numSamples * 2, 4)
  buf.write('WAVE', 8, 'ascii')
  buf.write('fmt ', 12, 'ascii')
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)              // PCM format
  buf.writeUInt16LE(1, 22)              // mono
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28) // byte rate (16-bit mono)
  buf.writeUInt16LE(2, 32)              // block align
  buf.writeUInt16LE(16, 34)             // bits per sample
  buf.write('data', 36, 'ascii')
  buf.writeUInt32LE(numSamples * 2, 40)
  for (let i = 0; i < numSamples; i++) {
    buf.writeInt16LE(samples[i], 44 + i * 2)
  }
  return buf
}

export function computeRms(frame: Int16Array): number {
  if (frame.length === 0) return 0
  const sumSq = frame.reduce((acc, s) => acc + s * s, 0)
  return Math.sqrt(sumSq / frame.length)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/voice/utils.test.ts
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/voice/utils.ts tests/voice/utils.test.ts
git commit -m "feat: voice utility functions (buildWav, computeRms) with tests"
```

---

### Task 4: Overlay UI

**Files:**
- Create: `src/app/voice/page.tsx`
- Create: `src/components/voice/VoiceOverlay.tsx`

- [ ] **Step 1: Create the Next.js route**

Create `src/app/voice/page.tsx`:

```tsx
import VoiceOverlay from '@/components/voice/VoiceOverlay'

export default function VoicePage() {
  return (
    <>
      <style>{`
        html, body { background: transparent !important; margin: 0; padding: 0; }
      `}</style>
      <VoiceOverlay />
    </>
  )
}
```

- [ ] **Step 2: Create the overlay component**

Create `src/components/voice/VoiceOverlay.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'

type VoiceState = 'listening' | 'thinking' | 'speaking'

interface Turn {
  user: string
  reply: string
}

interface StatePayload {
  state: VoiceState
  userText?: string
  replyText?: string
}

export default function VoiceOverlay() {
  const [state, setState] = useState<VoiceState>('listening')
  const [turns, setTurns] = useState<Turn[]>([])
  const [pendingUser, setPendingUser] = useState<string>('')

  useEffect(() => {
    const api = (window as unknown as { voiceAPI?: { onStateChange: (cb: (d: StatePayload) => void) => void; close: () => void } }).voiceAPI
    if (!api) return

    api.onStateChange((data: StatePayload) => {
      setState(data.state)
      if (data.state === 'thinking' && data.userText) {
        setPendingUser(data.userText)
      }
      if (data.state === 'speaking' && data.replyText) {
        setTurns((prev) => {
          const next = [...prev, { user: pendingUser, reply: data.replyText! }]
          return next.slice(-3) // keep last 3
        })
        setPendingUser('')
      }
    })
  }, [pendingUser])

  return (
    <div style={{
      width: 270,
      borderRadius: 18,
      padding: 16,
      background: 'rgba(10,10,20,0.82)',
      backdropFilter: 'blur(28px) saturate(1.4)',
      border: '1px solid rgba(255,255,255,0.12)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
      color: '#fff',
      userSelect: 'none',
    }}>
      {/* Header — draggable */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600,
          color: 'rgba(255,255,255,0.5)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: state === 'listening' ? '#22c55e' : state === 'thinking' ? '#f59e0b' : '#818cf8',
            boxShadow: `0 0 6px ${state === 'listening' ? '#22c55e' : state === 'thinking' ? '#f59e0b' : '#818cf8'}`,
          }} />
          JARVIS
        </div>
        <button
          onClick={() => {
            const api = (window as unknown as { voiceAPI?: { close: () => void } }).voiceAPI
            api?.close()
          }}
          style={{ WebkitAppRegion: 'no-drag', width: 18, height: 18, borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.4)', fontSize: 10, display: 'flex',
            alignItems: 'center', justifyContent: 'center' } as React.CSSProperties}
        >✕</button>
      </div>

      {/* Transcript */}
      {(turns.length > 0 || pendingUser) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {turns.map((t, i) => (
            <div key={i}>
              <div style={{ alignSelf: 'flex-end', display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ maxWidth: '90%', padding: '7px 10px', borderRadius: 10, fontSize: 12.5,
                  lineHeight: 1.45, background: 'rgba(99,102,241,0.35)',
                  border: '1px solid rgba(99,102,241,0.3)', color: 'rgba(255,255,255,0.9)' }}>
                  {t.user}
                </div>
              </div>
              <div style={{ maxWidth: '90%', padding: '7px 10px', borderRadius: 10, fontSize: 12.5,
                lineHeight: 1.45, background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)',
                marginTop: 6 }}>
                {t.reply}
              </div>
            </div>
          ))}
          {pendingUser && (
            <div style={{ alignSelf: 'flex-end', display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ maxWidth: '90%', padding: '7px 10px', borderRadius: 10, fontSize: 12.5,
                lineHeight: 1.45, background: 'rgba(99,102,241,0.35)',
                border: '1px solid rgba(99,102,241,0.3)', color: 'rgba(255,255,255,0.9)' }}>
                {pendingUser}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
        borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {state === 'listening' && <MicIcon />}
        {state === 'thinking' && <ThinkingDots />}
        {state === 'speaking' && <WaveBars />}
        <span style={{ fontSize: 11.5, fontStyle: 'italic',
          color: state === 'listening' ? '#22c55e' : state === 'thinking' ? 'rgba(255,255,255,0.4)' : '#818cf8' }}>
          {state === 'listening' ? 'Listening…' : state === 'thinking' ? 'Thinking…' : 'Speaking…'}
        </span>
      </div>

      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.55; }
          70% { transform: scale(1.7); opacity: 0; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        @keyframes pulse-dot { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }
        @keyframes dot-bounce { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-4px); } }
        @keyframes bar-wave { 0%,100% { height: 4px; } 50% { height: 14px; } }
        .mic-ring::before {
          content: ''; position: absolute; inset: 0; border-radius: 50%;
          background: rgba(34,197,94,0.4); animation: pulse-ring 1.5s ease-out infinite;
        }
      `}</style>
    </div>
  )
}

function MicIcon() {
  return (
    <div className="mic-ring" style={{ position: 'relative', width: 20, height: 20, flexShrink: 0 }}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
        style={{ position: 'relative', zIndex: 1, animation: 'pulse-dot 1.5s ease-in-out infinite',
          filter: 'drop-shadow(0 0 4px rgba(34,197,94,0.6))' }}>
        <rect x="7" y="2" width="6" height="10" rx="3" fill="rgba(34,197,94,0.9)" />
        <path d="M4 10a6 6 0 0 0 12 0" stroke="rgba(34,197,94,0.9)" strokeWidth="1.5"
          strokeLinecap="round" fill="none" />
        <line x1="10" y1="16" x2="10" y2="19" stroke="rgba(34,197,94,0.9)"
          strokeWidth="1.5" strokeLinecap="round" />
        <line x1="7" y1="19" x2="13" y2="19" stroke="rgba(34,197,94,0.9)"
          strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  )
}

function ThinkingDots() {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {[0, 0.15, 0.3].map((delay, i) => (
        <div key={i} style={{ width: 5, height: 5, borderRadius: '50%',
          background: 'rgba(255,255,255,0.4)',
          animation: `dot-bounce 1.2s ease-in-out ${delay}s infinite` }} />
      ))}
    </div>
  )
}

function WaveBars() {
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center', height: 18 }}>
      {[0, 0.1, 0.2, 0.3, 0.1].map((delay, i) => (
        <div key={i} style={{ width: 3, borderRadius: 2, background: '#818cf8', height: 4,
          animation: `bar-wave 0.8s ease-in-out ${delay}s infinite` }} />
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Run the dev server and verify /voice renders**

```bash
npm run dev
```

Open `http://localhost:3737/voice` in a browser. Expected: dark translucent card with "Listening…" state and green mic SVG. No nav or app chrome — just the overlay card on a transparent/white background.

- [ ] **Step 4: Commit**

```bash
git add src/app/voice/page.tsx src/components/voice/VoiceOverlay.tsx
git commit -m "feat: voice overlay UI component (/voice route)"
```

---

### Task 5: Update preload to expose voiceAPI

**Files:**
- Modify: `electron/preload.js`

- [ ] **Step 1: Update preload to expose voiceAPI IPC bridge**

Replace `electron/preload.js` with:

```js
'use strict'
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('isElectron', true)

contextBridge.exposeInMainWorld('voiceAPI', {
  onStateChange: (cb) => {
    ipcRenderer.on('voice:state', (_event, data) => cb(data))
  },
  close: () => {
    ipcRenderer.send('voice:close')
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add electron/preload.js
git commit -m "feat: expose voiceAPI IPC bridge in preload"
```

---

### Task 6: Voice engine

**Files:**
- Create: `electron/voice.js`

This file orchestrates everything: Porcupine wake word detection, audio recording, Whisper transcription, chat, TTS, and session lifecycle.

- [ ] **Step 1: Create electron/voice.js**

Create `electron/voice.js`:

```js
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

    let userText, reply, endSession
    try {
      userText = await transcribe(buildWav(samples), apiKey)
      if (!userText) { sendToOverlay('voice:state', { state: 'listening' }); continue }

      sendToOverlay('voice:state', { state: 'thinking', userText })

      const result = await sendChat(userText, conversationId, appPort)
      reply = result.message
      endSession = result.endSession
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

    if (endSession) break
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
```

- [ ] **Step 2: Commit**

```bash
git add electron/voice.js
git commit -m "feat: voice engine (Porcupine wake word, Whisper STT, TTS, session lifecycle)"
```

---

### Task 7: Wire voice engine into main.js

**Files:**
- Modify: `electron/main.js`

- [ ] **Step 1: Require voice engine at the top of main.js**

Add after the existing requires at the top of `electron/main.js`:

```js
const { startVoiceEngine, stopVoiceEngine } = require('./voice')
```

- [ ] **Step 2: Start voice engine after window is created**

In `app.whenReady()`, call `startVoiceEngine(port)` after the window is created. Replace the existing `app.whenReady()` block with:

```js
app.whenReady().then(async () => {
  if (app.isPackaged) {
    ensureDatabase()
    const port = await findFreePort(3000)
    startServer(port)
    await waitForServer(port)
    createWindow(port)
    startVoiceEngine(port)
  } else {
    createWindow(3737)
    startVoiceEngine(3737)
  }
})
```

- [ ] **Step 3: Stop voice engine on quit**

In the `app.on('will-quit')` handler, add `stopVoiceEngine()`:

```js
app.on('will-quit', () => {
  stopVoiceEngine()
  if (nextProcess) {
    nextProcess.kill()
    nextProcess = null
  }
})
```

- [ ] **Step 4: Commit**

```bash
git add electron/main.js
git commit -m "feat: wire voice engine into Electron main process"
```

---

### Task 8: Manual end-to-end test

No automated test possible here — this requires a real microphone and a valid Porcupine key.

- [ ] **Step 1: Get a Porcupine AccessKey**

Visit `https://console.picovoice.ai`, sign up for free, copy your AccessKey. Add it to `.env`:

```
PORCUPINE_ACCESS_KEY=your_actual_key_here
```

- [ ] **Step 2: Start the app in dev mode**

```bash
npm run electron:dev
```

Expected in terminal: `[voice] Wake word listener started — say "Jarvis"`

- [ ] **Step 3: Test wake word**

Say "Jarvis" clearly. Expected:
- Overlay window appears in bottom-right corner
- Green pulsing mic + "Listening…" text

- [ ] **Step 4: Test a full turn**

Say "What should I focus on tomorrow?" Wait for Jarvis to respond. Expected:
- State changes to yellow dots "Thinking…"
- State changes to indigo wave "Speaking…"
- You hear Jarvis reply through your speakers
- Transcript appears in overlay

- [ ] **Step 5: Test session end via voice**

Say "Thanks, that's all." Expected:
- Jarvis replies and overlay closes

- [ ] **Step 6: Test session timeout**

Wake word → don't speak for 30 seconds. Expected: overlay closes automatically.

- [ ] **Step 7: Test X button**

Wake word → click the X on the overlay. Expected: overlay closes, session ends.

- [ ] **Step 8: Verify conversation saved**

Open Jarvis app, check the chat log. Expected: the voice conversation appears as a saved conversation.

- [ ] **Step 9: Final commit**

```bash
git add .
git commit -m "feat: voice integration complete — wake word, STT, TTS, overlay"
```
