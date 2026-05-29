'use client'

import type { JarvisMemoryData, MemoryGoal, MemoryHabit } from '@/lib/llm/types'
import { useState } from 'react'
import { MemoryCard } from './MemoryCard'

interface Props {
  initialMemory: JarvisMemoryData
}

export function MemoryView({ initialMemory }: Props) {
  const [mem, setMem] = useState<JarvisMemoryData>(initialMemory)
  const [saving, setSaving] = useState(false)

  const save = async (updated: JarvisMemoryData) => {
    setMem(updated)
    setSaving(true)
    await fetch('/api/memory', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    })
    setSaving(false)
  }

  const updateGoal = (i: number, field: keyof MemoryGoal, value: string) => {
    const goals = [...mem.goals]
    goals[i] = { ...goals[i], [field]: value }
    save({ ...mem, goals })
  }

  const deleteGoal = (i: number) => {
    save({ ...mem, goals: mem.goals.filter((_, j) => j !== i) })
  }

  const updateHabit = (i: number, value: string) => {
    const habits = [...mem.habits]
    habits[i] = { ...habits[i], title: value }
    save({ ...mem, habits })
  }

  const deleteHabit = (i: number) => {
    save({ ...mem, habits: mem.habits.filter((_, j) => j !== i) })
  }

  const updateListItem = (key: 'interests' | 'keyFacts' | 'patterns', i: number, value: string) => {
    const arr = [...mem[key]]
    arr[i] = value
    save({ ...mem, [key]: arr })
  }

  const deleteListItem = (key: 'interests' | 'keyFacts' | 'patterns', i: number) => {
    save({ ...mem, [key]: mem[key].filter((_, j) => j !== i) })
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">What Jarvis knows about you</h2>
        {saving && <span className="text-xs text-zinc-400">Saving…</span>}
      </div>

      {(['goals', 'habits', 'interests', 'keyFacts', 'patterns'] as const).map((section) => (
        <div key={section}>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">
            {section === 'keyFacts' ? 'Key Facts' : section.charAt(0).toUpperCase() + section.slice(1)}
          </h3>
          <div className="space-y-2">
            {section === 'goals' && mem.goals.map((g, i) => (
              <MemoryCard key={i} label={g.horizon} value={g.title} onSave={(v) => updateGoal(i, 'title', v)} onDelete={() => deleteGoal(i)} />
            ))}
            {section === 'habits' && mem.habits.map((h, i) => (
              <MemoryCard key={i} label={h.frequency ?? ''} value={h.title} onSave={(v) => updateHabit(i, v)} onDelete={() => deleteHabit(i)} />
            ))}
            {(section === 'interests' || section === 'keyFacts' || section === 'patterns') && mem[section].map((item, i) => (
              <MemoryCard key={i} label="" value={item} onSave={(v) => updateListItem(section, i, v)} onDelete={() => deleteListItem(section, i)} />
            ))}
            {section === 'goals' && mem.goals.length === 0 && <p className="text-sm text-zinc-400">No goals yet — tell Jarvis about your goals in chat.</p>}
          </div>
        </div>
      ))}
    </div>
  )
}
