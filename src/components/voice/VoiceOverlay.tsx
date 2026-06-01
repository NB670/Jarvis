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
