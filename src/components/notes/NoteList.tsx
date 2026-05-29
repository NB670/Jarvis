'use client'

import type { Note } from '@prisma/client'

interface Props {
  notes: Note[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
}

function preview(content: string) {
  const lines = content.split('\n').filter((l) => l.trim())
  return lines.slice(1, 3).join(' ').replace(/^#+\s*/, '').slice(0, 80) || 'No additional text'
}

export function NoteList({ notes, selectedId, onSelect, onNew }: Props) {
  return (
    <div className="flex flex-col h-full w-64 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex-shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Notes</span>
        <button
          onClick={onNew}
          className="text-xl leading-none text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          aria-label="New note"
        >
          +
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {notes.length === 0 && (
          <p className="px-4 py-6 text-sm text-zinc-400">No notes yet. Hit + to create one.</p>
        )}
        {notes.map((note) => (
          <button
            key={note.id}
            onClick={() => onSelect(note.id)}
            className={`w-full text-left px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 transition-colors ${
              note.id === selectedId
                ? 'bg-zinc-200 dark:bg-zinc-700'
                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
              {note.title || 'Untitled'}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
              {preview(note.content)}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
