'use client'

import type { Note } from '@prisma/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MemoryView } from '@/components/jarvis/MemoryView'
import { NoteEditor } from './NoteEditor'
import { NoteList } from './NoteList'
import { TodayPanel } from './TodayPanel'

interface Props {
  initialNotes: Note[]
  initialDeletedNotes: Note[]
}

export function NotesClient({ initialNotes, initialDeletedNotes }: Props) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [deletedNotes, setDeletedNotes] = useState<Note[]>(initialDeletedNotes)
  const [selectedId, setSelectedId] = useState<string | null>(initialNotes[0]?.id ?? null)
  const [view, setView] = useState<'notes' | 'trash' | 'today' | 'memory'>('notes')
  const [taskDate, setTaskDate] = useState(() => new Date().toISOString().slice(0, 10))
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const creatingNote = useRef(false)

  const selectedNote = notes.find((n) => n.id === selectedId) ?? null

  const deleteEmptyNote = useCallback(async (id: string) => {
    const note = notes.find((n) => n.id === id)
    if (!note || note.content.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim()) return
    await fetch(`/api/notes/${id}?permanent=true`, { method: 'DELETE' })
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }, [notes])

  const handleNew = useCallback(async () => {
    if (creatingNote.current) return
    creatingNote.current = true
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '' }),
      })
      const note = (await res.json()) as Note
      setNotes((prev) => [note, ...prev])
      setSelectedId(note.id)
      setView('notes')
    } finally {
      creatingNote.current = false
    }
  }, [])

  const handleSelect = useCallback((id: string) => {
    if (selectedId && selectedId !== id) deleteEmptyNote(selectedId)
    setSelectedId(id)
  }, [selectedId, deleteEmptyNote])

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

  const handleDelete = useCallback(async (id: string) => {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    setNotes((prev) => prev.filter((n) => n.id !== id))
    const res = await fetch('/api/notes?deleted=true')
    setDeletedNotes(await res.json())
    setSelectedId((prev) => (prev === id ? null : prev))
  }, [])

  const handleRestore = useCallback(async (id: string) => {
    const res = await fetch(`/api/notes/${id}/restore`, { method: 'POST' })
    const restored = (await res.json()) as Note
    setDeletedNotes((prev) => prev.filter((n) => n.id !== id))
    setNotes((prev) => [restored, ...prev])
  }, [])

  const handlePermanentDelete = useCallback(async (id: string) => {
    await fetch(`/api/notes/${id}?permanent=true`, { method: 'DELETE' })
    setDeletedNotes((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const handlePermanentDeleteAll = useCallback(async () => {
    await Promise.all(
      deletedNotes.map((n) => fetch(`/api/notes/${n.id}?permanent=true`, { method: 'DELETE' })),
    )
    setDeletedNotes([])
  }, [deletedNotes])

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950">
      <NoteList
        notes={notes}
        deletedNotes={deletedNotes}
        selectedId={selectedId}
        view={view}
        onSelect={handleSelect}
        onNew={handleNew}
        onDelete={handleDelete}
        onRestore={handleRestore}
        onPermanentDelete={handlePermanentDelete}
        onPermanentDeleteAll={handlePermanentDeleteAll}
        onViewChange={(v) => {
          if (selectedId) deleteEmptyNote(selectedId)
          if (v === 'today') setTaskDate(new Date().toISOString().slice(0, 10))
          setView(v)
        }}
      />
      <div className="flex-1 overflow-hidden flex flex-col">
        {view === 'today' ? (
          <TodayPanel date={taskDate} onDateChange={setTaskDate} />
        ) : view === 'memory' ? (
          <MemoryView />
        ) : view === 'trash' ? (
          <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">
            Recently deleted notes are shown in the sidebar
          </div>
        ) : selectedNote ? (
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
