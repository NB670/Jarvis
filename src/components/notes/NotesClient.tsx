'use client'

import type { Note } from '@prisma/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { NoteEditor } from './NoteEditor'
import { NoteList } from './NoteList'

interface Props {
  initialNotes: Note[]
}

export function NotesClient({ initialNotes }: Props) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [selectedId, setSelectedId] = useState<string | null>(initialNotes[0]?.id ?? null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedNote = notes.find((n) => n.id === selectedId) ?? null

  const handleNew = useCallback(async () => {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '' }),
    })
    const note = (await res.json()) as Note
    setNotes((prev) => [note, ...prev])
    setSelectedId(note.id)
  }, [])

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
  }, [])

  const handleChange = useCallback(
    (html: string) => {
      if (!selectedId) return
      setNotes((prev) =>
        prev.map((n) => (n.id === selectedId ? { ...n, content: html } : n)),
      )

      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        await fetch(`/api/notes/${selectedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: html }),
        })
        const res = await fetch('/api/notes')
        const updated = (await res.json()) as Note[]
        setNotes(updated)
      }, 800)
    },
    [selectedId],
  )

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950">
      <NoteList
        notes={notes}
        selectedId={selectedId}
        onSelect={handleSelect}
        onNew={handleNew}
      />
      <div className="flex-1 overflow-hidden flex flex-col">
        {selectedNote ? (
          <NoteEditor
            key={selectedNote.id}
            content={selectedNote.content}
            onChange={handleChange}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">
            Select a note or create a new one
          </div>
        )}
      </div>
    </div>
  )
}
