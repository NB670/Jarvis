'use client'

import type { DailyTask } from '@prisma/client'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCallback, useEffect, useRef, useState } from 'react'

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function addDays(date: string, n: number): string {
  const d = new Date(date + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// ── Inline editable field ──────────────────────────────────────────────────

function InlineEdit({
  value,
  onSave,
  className,
  placeholder,
}: {
  value: string
  onSave: (v: string) => void
  className?: string
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) ref.current?.select()
  }, [editing])

  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) onSave(trimmed)
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
        className={`bg-transparent border-b border-zinc-400 dark:border-zinc-500 outline-none ${className}`}
        placeholder={placeholder}
      />
    )
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-text hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors ${className}`}
      title="Click to edit"
    >
      {value || placeholder}
    </span>
  )
}

// ── Task row (sortable) ────────────────────────────────────────────────────

function TaskRow({
  task,
  onComplete,
  onDelete,
  onUpdate,
  isDragging,
}: {
  task: DailyTask
  onComplete: (id: string, completed: boolean) => void
  onDelete: (id: string) => void
  onUpdate: (id: string, fields: Partial<Pick<DailyTask, 'title' | 'startAt' | 'durationMinutes'>>) => void
  isDragging?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? 'transform 200ms ease',
    opacity: isSortableDragging ? 0 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800 group transition-all duration-200 ${
        isDragging ? 'bg-zinc-50 dark:bg-zinc-800 shadow-lg rounded-lg' : 'bg-white dark:bg-zinc-950'
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className={`flex-shrink-0 text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 cursor-grab active:cursor-grabbing transition-opacity duration-150 ${
          hovered ? 'opacity-100' : 'opacity-0'
        }`}
        tabIndex={-1}
        title="Drag to reorder"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <circle cx="4" cy="3" r="1" fill="currentColor"/>
          <circle cx="8" cy="3" r="1" fill="currentColor"/>
          <circle cx="4" cy="6" r="1" fill="currentColor"/>
          <circle cx="8" cy="6" r="1" fill="currentColor"/>
          <circle cx="4" cy="9" r="1" fill="currentColor"/>
          <circle cx="8" cy="9" r="1" fill="currentColor"/>
        </svg>
      </button>

      {/* Checkbox */}
      <input
        type="checkbox"
        checked={!!task.completedAt}
        onChange={(e) => onComplete(task.id, e.target.checked)}
        className="w-4 h-4 rounded accent-zinc-600 flex-shrink-0 cursor-pointer transition-all duration-150"
      />

      {/* Content */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <InlineEdit
          value={task.title}
          onSave={(v) => onUpdate(task.id, { title: v })}
          className={`text-sm transition-all duration-200 ${
            task.completedAt
              ? 'line-through text-zinc-400 dark:text-zinc-500'
              : 'text-zinc-900 dark:text-zinc-100'
          }`}
        />
        {task.startAt && (
          <span className="text-xs text-zinc-400 flex-shrink-0">
            {task.startAt}{task.durationMinutes ? ` · ${task.durationMinutes}min` : ''}
          </span>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(task.id)}
        className={`w-5 h-5 flex items-center justify-center text-zinc-300 hover:text-red-400 transition-all duration-150 flex-shrink-0 ${
          hovered ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
        }`}
        title="Delete task"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  )
}

// ── Overlay (shown while dragging) ────────────────────────────────────────

function DragOverlayRow({ task }: { task: DailyTask }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-zinc-900 shadow-xl rounded-xl border border-zinc-200 dark:border-zinc-700 opacity-95">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-zinc-400">
        <circle cx="4" cy="3" r="1" fill="currentColor"/>
        <circle cx="8" cy="3" r="1" fill="currentColor"/>
        <circle cx="4" cy="6" r="1" fill="currentColor"/>
        <circle cx="8" cy="6" r="1" fill="currentColor"/>
        <circle cx="4" cy="9" r="1" fill="currentColor"/>
        <circle cx="8" cy="9" r="1" fill="currentColor"/>
      </svg>
      <input type="checkbox" checked={!!task.completedAt} readOnly className="w-4 h-4 rounded accent-zinc-600 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${task.completedAt ? 'line-through text-zinc-400' : 'text-zinc-900 dark:text-zinc-100'}`}>
          {task.title}
        </span>
        {task.startAt && (
          <span className="ml-2 text-xs text-zinc-400">{task.startAt} · {task.durationMinutes}min</span>
        )}
      </div>
    </div>
  )
}

// ── Animated task item (enter/exit) ───────────────────────────────────────

function AnimatedTask({
  task,
  onComplete,
  onDelete,
  onUpdate,
}: {
  task: DailyTask & { _new?: boolean }
  onComplete: (id: string, completed: boolean) => void
  onDelete: (id: string) => void
  onUpdate: (id: string, fields: Partial<Pick<DailyTask, 'title' | 'startAt' | 'durationMinutes'>>) => void
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  return (
    <div
      className="transition-all duration-300 ease-out overflow-hidden"
      style={{
        maxHeight: visible ? '80px' : '0px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-8px)',
      }}
    >
      <TaskRow task={task} onComplete={onComplete} onDelete={onDelete} onUpdate={onUpdate} />
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────

export function TodayPanel({ date, onDateChange }: { date: string; onDateChange: (d: string) => void }) {
  const [tasks, setTasks] = useState<DailyTask[]>([])
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const today = todayDate()
  const inputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const fetchTasks = useCallback(async () => {
    const res = await fetch(`/api/tasks/sync?date=${date}`, { method: 'POST' })
    if (res.ok) setTasks(await res.json())
  }, [date])

  useEffect(() => {
    fetchTasks()
    const id = setInterval(fetchTasks, 30_000)
    return () => clearInterval(id)
  }, [fetchTasks])

  const handleAdd = useCallback(async () => {
    const raw = input.trim()
    if (!raw) return
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawInput: raw, date }),
      })
      if (res.ok) {
        const task = (await res.json()) as DailyTask
        setNewIds((prev) => new Set(prev).add(task.id))
        setTasks((prev) => {
          const next = [...prev, task]
          return next.sort((a, b) => {
            if (!a.startAt && !b.startAt) return 0
            if (!a.startAt) return 1
            if (!b.startAt) return -1
            return a.startAt.localeCompare(b.startAt)
          })
        })
        setTimeout(() => setNewIds((prev) => { const s = new Set(prev); s.delete(task.id); return s }), 600)
      }
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [input, date])

  const handleComplete = useCallback(async (id: string, completed: boolean) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completedAt: completed ? new Date() : null } : t)),
    )
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    })
    if (res.ok) {
      const updated = await res.json()
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    }
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    setRemovingIds((prev) => new Set(prev).add(id))
    setTimeout(async () => {
      setTasks((prev) => prev.filter((t) => t.id !== id))
      setRemovingIds((prev) => { const s = new Set(prev); s.delete(id); return s })
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    }, 250)
  }, [])

  const handleUpdate = useCallback(async (id: string, fields: Partial<Pick<DailyTask, 'title' | 'startAt' | 'durationMinutes'>>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...fields } : t)))
    await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
  }, [])

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over || active.id === over.id) return

    setTasks((prev) => {
      const oldIndex = prev.findIndex((t) => t.id === active.id)
      const newIndex = prev.findIndex((t) => t.id === over.id)
      const reordered = arrayMove(prev, oldIndex, newIndex)

      // Swap startAt/durationMinutes between the two moved tasks so calendar order matches
      const a = prev[oldIndex]
      const b = prev[newIndex]
      if (a.startAt || b.startAt) {
        const aTime = { startAt: a.startAt, durationMinutes: a.durationMinutes }
        const bTime = { startAt: b.startAt, durationMinutes: b.durationMinutes }
        // Fire-and-forget calendar sync
        fetch(`/api/tasks/${a.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bTime) })
        fetch(`/api/tasks/${b.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(aTime) })
        // Reflect swap in local state too
        return reordered.map((t) => {
          if (t.id === a.id) return { ...t, ...bTime }
          if (t.id === b.id) return { ...t, ...aTime }
          return t
        })
      }

      return reordered
    })
  }

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onDateChange(addDays(date, -1))}
            className="w-7 h-7 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-150 active:scale-90"
            title="Previous day"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1 className="flex-1 text-center text-sm font-semibold text-zinc-900 dark:text-zinc-100 transition-all duration-200">
            {formatDate(date)}
          </h1>
          <button
            onClick={() => onDateChange(addDays(date, 1))}
            className="w-7 h-7 flex items-center justify-center rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all duration-150 active:scale-90"
            title="Next day"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 2L10 7L5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        {date !== today && (
          <button
            onClick={() => onDateChange(today)}
            className="mt-1 w-full text-center text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-150"
          >
            Jump to today
          </button>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
            placeholder='Add a task… (e.g. "gym 9am 1hr")'
            disabled={loading}
            className="flex-1 text-sm bg-transparent border-none outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 transition-opacity duration-150 disabled:opacity-50"
          />
          {loading && (
            <span className="text-xs text-zinc-400 animate-pulse">parsing…</span>
          )}
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 && !loading && (
          <p className="px-6 py-8 text-sm text-zinc-400 transition-opacity duration-300">
            No tasks yet. Type anything above to add one.
          </p>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {tasks.map((task) => (
              <div
                key={task.id}
                className="transition-all duration-250 ease-out"
                style={{
                  opacity: removingIds.has(task.id) ? 0 : 1,
                  maxHeight: removingIds.has(task.id) ? '0px' : '80px',
                  transform: removingIds.has(task.id) ? 'translateX(12px)' : 'translateX(0)',
                  overflow: 'hidden',
                }}
              >
                {newIds.has(task.id) ? (
                  <AnimatedTask
                    task={task}
                    onComplete={handleComplete}
                    onDelete={handleDelete}
                    onUpdate={handleUpdate}
                  />
                ) : (
                  <TaskRow
                    task={task}
                    onComplete={handleComplete}
                    onDelete={handleDelete}
                    onUpdate={handleUpdate}
                  />
                )}
              </div>
            ))}
          </SortableContext>

          <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>
            {activeTask ? <DragOverlayRow task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}
