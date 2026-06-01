# Voice Integration Design

## Goal

Add always-on voice interaction to Jarvis: say "Jarvis" to wake it, speak naturally, hear it reply — all while working in other apps. Each voice session saves as a conversation in the existing chat log.

## Architecture

Three components work together:

**Voice Engine (Electron main process)**
Runs continuously in the background. Porcupine listens for the "Jarvis" wake word at ~1% CPU using the local `@picovoice/porcupine-node` + `@picovoice/pvrecorder-node` packages. On detection it orchestrates the full turn loop: record → transcribe → chat → speak. It manages session state and IPC communication with the overlay window.

**Floating Overlay Window (second BrowserWindow)**
A frameless, transparent, always-on-top window anchored to the bottom-right corner of the screen. Served by Next.js at `/voice`. Shows three animated states (listening / thinking / speaking) and a running transcript of the current session. Draggable. Has an X button to manually end the session. Created on wake word, destroyed on session end.

**Existing Chat Infrastructure**
No changes to `runJarvisChat()`, the DB layer, or the chat API. The voice engine creates a conversation via `POST /api/conversations` at session start, then POSTs each turn to `POST /api/chat` with that `conversationId`. The full conversation is saved to the DB in real time as it happens.

## Tech Stack

- **Wake word:** `@picovoice/porcupine-node` + `@picovoice/pvrecorder-node` — "Jarvis" is a built-in keyword, no custom model needed. Requires a free Porcupine AccessKey set as `PORCUPINE_ACCESS_KEY` in `.env`.
- **STT:** OpenAI Whisper (`whisper-1`) via existing `OPENAI_API_KEY`
- **LLM:** Existing `runJarvisChat()` via `/api/chat`
- **TTS:** OpenAI TTS (`tts-1`, voice `onyx`) via existing `OPENAI_API_KEY`
- **Audio playback:** macOS `afplay` (already used in `src/lib/macos/`)

## Turn-by-Turn Flow

```
Wake word detected
  → POST /api/conversations  (create conversation, get conversationId)
  → Open overlay window (IPC: show, state=listening)

Loop:
  Record audio (pvrecorder)
  Silence for 1.5s → stop recording
  IPC: state=thinking, userText=<transcript>
  POST /v1/audio/transcriptions (Whisper) → transcribed text
  POST /api/chat { message: text, conversationId } → reply text
  IPC: state=speaking, replyText=<reply>
  POST /v1/audio/speech (TTS) → MP3 stream → temp file → afplay
  Wait for afplay to finish
  Check reply for [END_SESSION] marker → if found, end session
  Otherwise → IPC: state=listening, restart loop

Session end (voice command OR 30s silence timeout):
  IPC: close overlay window
  Conversation already fully saved in DB
```

## Session End Detection

The system prompt instructs Jarvis: when the user says goodbye, thanks, or signals the end of the conversation, append `[END_SESSION]` to the reply. The voice engine strips this marker before sending to TTS. The 30-second silence timeout fires if no speech is detected for 30s after entering listening state (i.e. after Jarvis finishes speaking). Only one voice session can be active at a time — if the wake word fires while a session is already running, it is ignored.

## Overlay UI States

| State | Indicator | Status text colour |
|---|---|---|
| Listening | SVG mic icon, green pulse ring | Green |
| Thinking | Three bouncing dots | Muted white |
| Speaking | Five animated waveform bars | Indigo |

The transcript area shows the last 3 exchanges. The overlay is ~270px wide, dark translucent background (rgba 10,10,20 at 82% opacity), frosted glass effect. Draggable via `-webkit-app-region: drag` on the header.

## New Files

| File | Responsibility |
|---|---|
| `src/lib/voice/recorder.ts` | Mic recording via pvrecorder, RMS silence detection, returns WAV Buffer |
| `src/lib/voice/transcribe.ts` | Sends WAV Buffer to Whisper API, returns transcript string |
| `src/lib/voice/speak.ts` | Sends text to OpenAI TTS, writes temp MP3, plays via `afplay`, resolves when done |
| `src/lib/voice/session.ts` | Session state machine: tracks conversationId, timeout timer, current state |
| `electron/voice.ts` | Porcupine init, orchestrates the turn loop, sends/receives IPC events |
| `src/app/voice/page.tsx` | Next.js route for the overlay window (no layout, no nav) |
| `src/components/voice/VoiceOverlay.tsx` | Overlay UI: state display, transcript, animations, IPC listener |

**Modified files:**
- `electron/main.ts` — import and start voice engine; create overlay `BrowserWindow` on `show-voice-overlay` IPC event
- `electron/preload.ts` — expose `voiceAPI` to renderer: `onStateChange(cb)`, `onTranscript(cb)`, `close()`
- `src/lib/llm/prompts/system.ts` — add `[END_SESSION]` instruction to system prompt

## IPC Events

| Event | Direction | Payload |
|---|---|---|
| `voice:show` | main → renderer | `{ conversationId }` |
| `voice:state` | main → renderer | `{ state: 'listening' \| 'thinking' \| 'speaking', userText?: string, replyText?: string }` |
| `voice:close` | renderer → main | — (X button or voice command end) |

## Error Handling

- **Mic permission denied:** overlay shows an error message, voice engine stops, no crash
- **`PORCUPINE_ACCESS_KEY` not set:** voice silently disabled on startup, no wake word listener registered
- **Whisper API fails:** skip the turn, log error, return to listening state
- **TTS API fails:** show reply text in overlay but skip audio playback
- **`afplay` not available:** TTS falls back to text-only silently

## Environment Variables

```
PORCUPINE_ACCESS_KEY=  # free key from console.picovoice.ai
# OPENAI_API_KEY already required — Whisper + TTS use the same key
```
