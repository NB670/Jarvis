'use client'

import type { Note } from '@prisma/client'
import { useState } from 'react'

interface Props {
  notes: Note[]
  deletedNotes: Note[]
  selectedId: string | null
  view: 'notes' | 'trash' | 'today'
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
  onPermanentDelete: (id: string) => void
  onPermanentDeleteAll: () => void
  onViewChange: (view: 'notes' | 'trash' | 'today') => void
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
      className={`relative w-full border-b border-zinc-100 dark:border-zinc-800 transition-colors ${
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
    <div className="w-full px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">
        {note.title || 'Untitled'}
      </p>
      <div className="flex items-center gap-2 mt-0.5">
        <button
          onClick={onRestore}
          className="text-xs text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
        >
          Restore
        </button>
        <span className="text-zinc-300 dark:text-zinc-600 text-xs">·</span>
        <button
          onClick={onPermanentDelete}
          className="text-xs text-zinc-400 hover:text-red-500 transition-colors"
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
  onPermanentDeleteAll,
  onViewChange,
}: Props) {
  const todayLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className="flex flex-col h-full w-64 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex-shrink-0">
      <button
        onClick={() => onViewChange('today')}
        className={`w-full text-left px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 transition-colors ${
          view === 'today'
            ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
            : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
        }`}
      >
        <span className="text-sm font-medium">Today</span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">{todayLabel}</span>
      </button>
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          {view === 'trash' ? 'Recently Deleted' : 'Notes'}
        </span>
        <div className="flex items-center gap-2">
          {view === 'trash' ? (
            <button
              onClick={() => onViewChange('notes')}
              className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              Done
            </button>
          ) : (
            <button
              onClick={onNew}
              className="text-xl leading-none text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              aria-label="New note"
            >
              +
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {(view === 'notes' || view === 'today') && (
          <>
            {notes.length === 0 && (
              <p className="px-4 py-6 text-sm text-zinc-400">No notes yet. Hit + to create one.</p>
            )}
            {notes.map((note) => (
              <NoteRow
                key={note.id}
                note={note}
                selected={note.id === selectedId && view === 'notes'}
                onSelect={() => {
                  if (view === 'today') onViewChange('notes')
                  onSelect(note.id)
                }}
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

      {view === 'notes' && deletedNotes.length > 0 && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-2 flex items-center justify-between">
          <button
            onClick={() => onViewChange('trash')}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            Recently Deleted ({deletedNotes.length})
          </button>
        </div>
      )}

      {view === 'trash' && deletedNotes.length > 0 && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-2">
          <button
            onClick={onPermanentDeleteAll}
            className="text-xs text-red-400 hover:text-red-500 transition-colors"
          >
            Delete All
          </button>
        </div>
      )}
    </div>
  )
}
