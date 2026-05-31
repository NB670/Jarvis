'use client'

import type { JarvisMemoryData, MemoryGoal, MemoryHabit } from '@/lib/llm/types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MemoryCard } from './MemoryCard'

interface Props {
  initialMemory?: JarvisMemoryData
}

const EMPTY: JarvisMemoryData = {
  goals: [], habits: [], interests: [], patterns: [], keyFacts: [], preferences: {},
}

export function MemoryView({ initialMemory }: Props) {
  const [mem, setMem] = useState<JarvisMemoryData>(initialMemory ?? EMPTY)
  const [saving, setSaving] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!initialMemory) {
      fetch('/api/memory').then((r) => r.json()).then((data) => setMem(data as JarvisMemoryData))
    }
  }, [initialMemory])

  const save = useCallback(async (updated: JarvisMemoryData) => {
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

  const updateGoal = (i: number, field: keyof MemoryGoal, value: string) => {
    const goals = [...mem.goals]
    goals[i] = { ...goals[i], [field]: value }
    save({ ...mem, goals })
  }
  const deleteGoal = (i: number) => save({ ...mem, goals: mem.goals.filter((_, j) => j !== i) })
  const addGoal = (title: string) =>
    save({ ...mem, goals: [...mem.goals, { title, horizon: 'short_term' }] })

  const updateHabit = (i: number, value: string) => {
    const habits = [...mem.habits]
    habits[i] = { ...habits[i], title: value }
    save({ ...mem, habits })
  }
  const deleteHabit = (i: number) => save({ ...mem, habits: mem.habits.filter((_, j) => j !== i) })
  const addHabit = (title: string) => save({ ...mem, habits: [...mem.habits, { title }] })

  const updateListItem = (key: 'interests' | 'keyFacts' | 'patterns', i: number, value: string) => {
    const arr = [...mem[key]]
    arr[i] = value
    save({ ...mem, [key]: arr })
  }
  const deleteListItem = (key: 'interests' | 'keyFacts' | 'patterns', i: number) =>
    save({ ...mem, [key]: mem[key].filter((_, j) => j !== i) })
  const addListItem = (key: 'interests' | 'keyFacts' | 'patterns', value: string) =>
    save({ ...mem, [key]: [...mem[key], value] })

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">What Jarvis knows about you</h2>
        {saving && <span className="text-xs text-zinc-400">Saving…</span>}
      </div>

      <Section title="Goals">
        {mem.goals.map((g, i) => (
          <MemoryCard
            key={i}
            label={g.horizon.replace('_', ' ')}
            value={g.title}
            onSave={(v) => updateGoal(i, 'title', v)}
            onDelete={() => deleteGoal(i)}
          />
        ))}
        <AddRow placeholder="Add a goal…" onAdd={addGoal} />
      </Section>

      <Section title="Habits">
        {mem.habits.map((h, i) => (
          <MemoryCard
            key={i}
            label={h.frequency ?? ''}
            value={h.title}
            onSave={(v) => updateHabit(i, v)}
            onDelete={() => deleteHabit(i)}
          />
        ))}
        <AddRow placeholder="Add a habit…" onAdd={addHabit} />
      </Section>

      <Section title="Interests">
        {mem.interests.map((item, i) => (
          <MemoryCard key={i} label="" value={item} onSave={(v) => updateListItem('interests', i, v)} onDelete={() => deleteListItem('interests', i)} />
        ))}
        <AddRow placeholder="Add an interest…" onAdd={(v) => addListItem('interests', v)} />
      </Section>

      <Section title="Key Facts">
        {mem.keyFacts.map((item, i) => (
          <MemoryCard key={i} label="" value={item} onSave={(v) => updateListItem('keyFacts', i, v)} onDelete={() => deleteListItem('keyFacts', i)} />
        ))}
        <AddRow placeholder="Add a key fact…" onAdd={(v) => addListItem('keyFacts', v)} />
      </Section>

      <Section title="Patterns">
        {mem.patterns.map((item, i) => (
          <MemoryCard key={i} label="" value={item} onSave={(v) => updateListItem('patterns', i, v)} onDelete={() => deleteListItem('patterns', i)} />
        ))}
        <AddRow placeholder="Add a pattern…" onAdd={(v) => addListItem('patterns', v)} />
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [value, setValue] = useState('')

  const commit = () => {
    const v = value.trim()
    if (!v) return
    onAdd(v)
    setValue('')
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
        placeholder={placeholder}
        className="flex-1 text-sm bg-transparent outline-none text-zinc-700 dark:text-zinc-300 placeholder-zinc-400 dark:placeholder-zinc-600"
      />
      {value.trim() && (
        <button onClick={commit} className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">Add</button>
      )}
    </div>
  )
}
