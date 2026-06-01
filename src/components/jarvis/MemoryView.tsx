'use client'

import type { JarvisMemoryData, MemoryGoal, MemoryHabit } from '@/lib/llm/types'
import { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  initialMemory?: JarvisMemoryData
}

const EMPTY: JarvisMemoryData = {
  goals: [], habits: [], interests: [], patterns: [], keyFacts: [], preferences: {},
}

// ── Inline editable text ──────────────────────────────────────────────────

function EditableText({ value, onSave, className, placeholder }: {
  value: string
  onSave: (v: string) => void
  className?: string
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) ref.current?.select() }, [editing])

  const commit = () => {
    setEditing(false)
    const v = draft.trim()
    if (v && v !== value) onSave(v)
    else setDraft(value)
  }

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setDraft(value); setEditing(false) }
        }}
        className={`bg-transparent border-b border-zinc-400 dark:border-zinc-500 outline-none w-full ${className}`}
      />
    )
  }

  return (
    <span
      onClick={() => setEditing(true)}
      title="Click to edit"
      className={`cursor-text hover:opacity-70 transition-opacity ${className}`}
    >
      {value || <span className="text-zinc-400">{placeholder}</span>}
    </span>
  )
}

// ── Row with delete on hover ───────────────────────────────────────────────

function Row({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      className="flex items-center gap-2 group py-1.5"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex-1 min-w-0">{children}</div>
      <button
        onClick={onDelete}
        className={`w-5 h-5 flex items-center justify-center text-zinc-300 hover:text-red-400 transition-all flex-shrink-0 ${hovered ? 'opacity-100' : 'opacity-0'}`}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  )
}

// ── Add input ─────────────────────────────────────────────────────────────

function AddInput({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [value, setValue] = useState('')

  const commit = () => {
    const v = value.trim()
    if (!v) return
    onAdd(v)
    setValue('')
  }

  return (
    <div className="flex items-center gap-2 py-1.5 border-t border-dashed border-zinc-100 dark:border-zinc-800 mt-1">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
        placeholder={placeholder}
        className="flex-1 text-sm bg-transparent outline-none text-zinc-600 dark:text-zinc-400 placeholder-zinc-300 dark:placeholder-zinc-600"
      />
      {value.trim() && (
        <button onClick={commit} className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors flex-shrink-0">
          Add ↵
        </button>
      )}
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-2">{title}</h3>
      <div className="divide-y divide-zinc-50 dark:divide-zinc-900">{children}</div>
    </div>
  )
}

// ── Horizon badge ─────────────────────────────────────────────────────────

function HorizonBadge({ value, onChange }: { value: MemoryGoal['horizon']; onChange: (v: MemoryGoal['horizon']) => void }) {
  const options: MemoryGoal['horizon'][] = ['short_term', 'long_term']
  return (
    <button
      onClick={() => onChange(value === 'short_term' ? 'long_term' : 'short_term')}
      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full transition-colors flex-shrink-0 ${
        value === 'long_term'
          ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400'
          : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
      }`}
      title="Click to toggle"
    >
      {value === 'long_term' ? 'long-term' : 'short-term'}
    </button>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────

export function MemoryView({ initialMemory }: Props) {
  const [mem, setMem] = useState<JarvisMemoryData>(initialMemory ?? EMPTY)
  const [saving, setSaving] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!initialMemory) {
      fetch('/api/memory').then((r) => r.json()).then((data) => setMem(data as JarvisMemoryData))
    }
  }, [initialMemory])

  const save = useCallback((updated: JarvisMemoryData) => {
    setMem(updated)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaving(true)
    saveTimer.current = setTimeout(async () => {
      await fetch('/api/memory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      setSaving(false)
    }, 400)
  }, [])

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Memory</h2>
            <p className="text-xs text-zinc-400 mt-0.5">What Jarvis knows about you — click any item to edit</p>
          </div>
          {saving && <span className="text-xs text-zinc-400 animate-pulse">Saving…</span>}
        </div>

        {/* Onboarding prompt when memory is empty */}
        {mem.goals.length === 0 && mem.habits.length === 0 && mem.keyFacts.length === 0 && mem.interests.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700 p-5 space-y-2">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Jarvis doesn't know much about you yet</p>
            <p className="text-xs text-zinc-400 leading-5">
              The more you share, the better Jarvis can help you plan and prioritise. You can add things manually below, or just chat — Jarvis will pick things up automatically as you talk.
            </p>
            <p className="text-xs text-zinc-400 leading-5">
              Try starting with a goal, a habit you're tracking, or a key fact about your life.
            </p>
          </div>
        )}

        {/* Goals */}
        <Section title="Goals">
          {mem.goals.map((g, i) => (
            <Row key={i} onDelete={() => save({ ...mem, goals: mem.goals.filter((_, j) => j !== i) })}>
              <div className="flex items-center gap-2">
                <HorizonBadge
                  value={g.horizon}
                  onChange={(h) => {
                    const goals = [...mem.goals]
                    goals[i] = { ...goals[i], horizon: h }
                    save({ ...mem, goals })
                  }}
                />
                <EditableText
                  value={g.title}
                  onSave={(v) => {
                    const goals = [...mem.goals]
                    goals[i] = { ...goals[i], title: v }
                    save({ ...mem, goals })
                  }}
                  className="text-sm text-zinc-800 dark:text-zinc-200"
                />
              </div>
            </Row>
          ))}
          <AddInput placeholder="Add a goal…" onAdd={(title) =>
            save({ ...mem, goals: [...mem.goals, { title, horizon: 'short_term' }] })
          } />
        </Section>

        {/* Habits */}
        <Section title="Habits">
          {mem.habits.map((h, i) => (
            <Row key={i} onDelete={() => save({ ...mem, habits: mem.habits.filter((_, j) => j !== i) })}>
              <div className="flex items-center gap-2">
                {h.frequency && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                    {h.frequency}
                  </span>
                )}
                <EditableText
                  value={h.title}
                  onSave={(v) => {
                    const habits = [...mem.habits]
                    habits[i] = { ...habits[i], title: v }
                    save({ ...mem, habits })
                  }}
                  className="text-sm text-zinc-800 dark:text-zinc-200"
                />
              </div>
            </Row>
          ))}
          <AddInput placeholder="Add a habit…" onAdd={(title) =>
            save({ ...mem, habits: [...mem.habits, { title }] })
          } />
        </Section>

        {/* Key Facts */}
        <Section title="Key Facts">
          {mem.keyFacts.map((item, i) => (
            <Row key={i} onDelete={() => save({ ...mem, keyFacts: mem.keyFacts.filter((_, j) => j !== i) })}>
              <EditableText
                value={item}
                onSave={(v) => {
                  const keyFacts = [...mem.keyFacts]
                  keyFacts[i] = v
                  save({ ...mem, keyFacts })
                }}
                className="text-sm text-zinc-800 dark:text-zinc-200"
              />
            </Row>
          ))}
          <AddInput placeholder="Add a key fact…" onAdd={(v) =>
            save({ ...mem, keyFacts: [...mem.keyFacts, v] })
          } />
        </Section>

        {/* Interests */}
        <Section title="Interests">
          {mem.interests.map((item, i) => (
            <Row key={i} onDelete={() => save({ ...mem, interests: mem.interests.filter((_, j) => j !== i) })}>
              <EditableText
                value={item}
                onSave={(v) => {
                  const interests = [...mem.interests]
                  interests[i] = v
                  save({ ...mem, interests })
                }}
                className="text-sm text-zinc-800 dark:text-zinc-200"
              />
            </Row>
          ))}
          <AddInput placeholder="Add an interest…" onAdd={(v) =>
            save({ ...mem, interests: [...mem.interests, v] })
          } />
        </Section>

        {/* Patterns */}
        <Section title="Patterns">
          {mem.patterns.map((item, i) => (
            <Row key={i} onDelete={() => save({ ...mem, patterns: mem.patterns.filter((_, j) => j !== i) })}>
              <EditableText
                value={item}
                onSave={(v) => {
                  const patterns = [...mem.patterns]
                  patterns[i] = v
                  save({ ...mem, patterns })
                }}
                className="text-sm text-zinc-800 dark:text-zinc-200"
              />
            </Row>
          ))}
          <AddInput placeholder="Add a pattern…" onAdd={(v) =>
            save({ ...mem, patterns: [...mem.patterns, v] })
          } />
        </Section>
      </div>
    </div>
  )
}
