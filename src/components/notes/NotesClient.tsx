'use client'

import type { Note } from '@prisma/client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { NoteEditor } from './NoteEditor'
import { NoteList } from './NoteList'
import { TodayPanel } from './TodayPanel'

const DRAFT_ID = '__draft__'

interface Props {
  initialNotes: Note[]
  initialDeletedNotes: Note[]
}

function makeDraft(): Note {
  return {
    id: DRAFT_ID,
    title: '',
    content: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  }
}

function hasText(content: string) {
  return content.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim().length > 0
}

export function NotesClient({ initialNotes, initialDeletedNotes }: Props) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [deletedNotes, setDeletedNotes] = useState<Note[]>(initialDeletedNotes)
  const [selectedId, setSelectedId] = useState<string | null>(initialNotes[0]?.id ?? null)
  const [view, setView] = useState<'notes' | 'trash' | 'today'>('notes')
  const [taskDate, setTaskDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [draft, setDraft] = useState<Note | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // All visible notes = draft (if active) + real notes
  const displayNotes = draft ? [draft, ...notes] : notes
  const selectedNote = draft?.id === selectedId ? draft : notes.find((n) => n.id === selectedId) ?? null

  const discardDraftIfEmpty = useCallback(() => {
    setDraft((d) => (d && !hasText(d.content) ? null : d))
    setSelectedId((id) => (id === DRAFT_ID ? null : id))
  }, [])

  const handleNew = useCallback(() => {
    if (selectedId === DRAFT_ID) return // already drafting
    discardDraftIfEmpty()
    const d = makeDraft()
    setDraft(d)
    setSelectedId(DRAFT_ID)
    setView('notes')
  }, [selectedId, discardDraftIfEmpty])

  const handleSelect = useCallback((id: string) => {
    discardDraftIfEmpty()
    setSelectedId(id)
  }, [discardDraftIfEmpty])

  const handleChange = useCallback(
    async (html: string) => {
      if (!selectedId) return

      if (selectedId === DRAFT_ID) {
        // Update draft content locally
        setDraft((d) => d ? { ...d, content: html } : null)

        if (!hasText(html)) return // don't save empty drafts

        // First real content — persist to DB
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(async () => {
          const res = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: html }),
          })
          const note = (await res.json()) as Note
          setDraft(null)
          setNotes((prev) => [note, ...prev])
          setSelectedId(note.id)
        }, 800)
        return
      }

      // Existing note — update in state and debounce save
      setNotes((prev) => prev.map((n) => (n.id === selectedId ? { ...n, content: html } : n)))

      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        const res = await fetch(`/api/notes/${selectedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: html }),
        })
        if (res.ok) {
          const updated = (await res.json()) as Note
          setNotes((prev) => prev.map((n) => (n.id === selectedId ? updated : n)))
        }
      }, 800)
    },
    [selectedId],
  )

  const handleDelete = useCallback(async (id: string) => {
    if (id === DRAFT_ID) {
      setDraft(null)
      setSelectedId(null)
      return
    }
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
        notes={displayNotes}
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
          discardDraftIfEmpty()
          if (v === 'today') setTaskDate(new Date().toISOString().slice(0, 10))
          setView(v)
        }}
      />
      <div className="flex-1 overflow-hidden flex flex-col">
        {view === 'today' ? (
          <TodayPanel date={taskDate} onDateChange={setTaskDate} />
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
