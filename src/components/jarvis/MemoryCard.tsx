'use client'

import { useState } from 'react'

interface Props {
  label: string
  value: string
  onSave: (newValue: string) => void
  onDelete: () => void
}

export function MemoryCard({ label, value, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl">
      <div className="flex-1 min-w-0">
        {label && (
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">{label}</p>
        )}
        {editing ? (
          <div className="flex gap-2 mt-1">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { onSave(draft); setEditing(false) }
                if (e.key === 'Escape') { setDraft(value); setEditing(false) }
              }}
              className="flex-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg px-2 py-1 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            />
            <button onClick={() => { onSave(draft); setEditing(false) }} className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">Save</button>
          </div>
        ) : (
          <p className="text-sm text-zinc-800 dark:text-zinc-200 cursor-pointer" onClick={() => setEditing(true)}>{value}</p>
        )}
      </div>
      <button onClick={onDelete} className="text-zinc-300 hover:text-red-400 text-lg leading-none flex-shrink-0" aria-label="Delete">×</button>
    </div>
  )
}
