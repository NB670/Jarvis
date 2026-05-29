'use client'

import type { Note } from '@prisma/client'
import { useState } from 'react'

interface Props {
  notes: Note[]
  deletedNotes: Note[]
  selectedId: string | null
  view: 'notes' | 'trash'
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
  onPermanentDelete: (id: string) => void
  onViewChange: (view: 'notes' | 'trash') => void
}

function preview(content: string) {
  const lines = content.split('\n').filter((l) => l.trim())
  return lines.slice(1, 3).join(' ').replace(/^#+\s*/, '').slice(0, 80) || 'No additional text'
}

function NoteRow({
  note,
  selected,
  onSelect,
  onDelete,
}: {
  note: Note
  selected: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={`relative group w-full text-left border-b border-zinc-100 dark:border-zinc-800 transition-colors ${
        selected ? 'bg-zinc-200 dark:bg-zinc-700' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button onClick={onSelect} className="w-full text-left px-4 py-3 pr-8">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
          {note.title || 'Untitled'}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
          {preview(note.content)}
        </p>
      </button>
      {hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
          title="Delete note"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </div>
  )
}

function DeletedNoteRow({
  note,
  onRestore,
  onPermanentDelete,
}: {
  note: Note
  onRestore: () => void
  onPermanentDelete: () => void
}) {
  return (
    <div className="w-full text-left px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 group">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 truncate">
        {note.title || 'Untitled'}
      </p>
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={onRestore}
          className="text-xs text-blue-500 hover:text-blue-600 dark:hover:text-blue-400"
        >
          Restore
        </button>
        <span className="text-zinc-300 dark:text-zinc-600">·</span>
        <button
          onClick={onPermanentDelete}
          className="text-xs text-red-400 hover:text-red-500"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

export function NoteList({
  notes,
  deletedNotes,
  selectedId,
  view,
  onSelect,
  onNew,
  onDelete,
  onRestore,
  onPermanentDelete,
  onViewChange,
}: Props) {
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

      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => onViewChange('notes')}
          className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
            view === 'notes'
              ? 'text-zinc-900 dark:text-zinc-100 border-b-2 border-zinc-700 dark:border-zinc-300'
              : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          Notes
        </button>
        <button
          onClick={() => onViewChange('trash')}
          className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
            view === 'trash'
              ? 'text-zinc-900 dark:text-zinc-100 border-b-2 border-zinc-700 dark:border-zinc-300'
              : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          Recently Deleted {deletedNotes.length > 0 && `(${deletedNotes.length})`}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {view === 'notes' && (
          <>
            {notes.length === 0 && (
              <p className="px-4 py-6 text-sm text-zinc-400">No notes yet. Hit + to create one.</p>
            )}
            {notes.map((note) => (
              <NoteRow
                key={note.id}
                note={note}
                selected={note.id === selectedId}
                onSelect={() => onSelect(note.id)}
                onDelete={() => onDelete(note.id)}
              />
            ))}
          </>
        )}
        {view === 'trash' && (
          <>
            {deletedNotes.length === 0 && (
              <p className="px-4 py-6 text-sm text-zinc-400">No recently deleted notes.</p>
            )}
            {deletedNotes.map((note) => (
              <DeletedNoteRow
                key={note.id}
                note={note}
                onRestore={() => onRestore(note.id)}
                onPermanentDelete={() => onPermanentDelete(note.id)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
