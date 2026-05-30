'use client'

import type { DailyTask } from '@prisma/client'
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

function TaskRow({
  task,
  onComplete,
  onDelete,
}: {
  task: DailyTask
  onComplete: (id: string, completed: boolean) => void
  onDelete: (id: string) => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800 group transition-colors ${
        task.completedAt ? 'opacity-50' : ''
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <input
        type="checkbox"
        checked={!!task.completedAt}
        onChange={(e) => onComplete(task.id, e.target.checked)}
        className="w-4 h-4 rounded accent-zinc-600 flex-shrink-0 cursor-pointer"
      />
      <div className="flex-1 min-w-0">
        <span
          className={`text-sm text-zinc-900 dark:text-zinc-100 ${
            task.completedAt ? 'line-through' : ''
          }`}
        >
          {task.title}
        </span>
        {task.startAt && (
          <span className="ml-2 text-xs text-zinc-400">
            {task.startAt} · {task.durationMinutes}min
          </span>
        )}
      </div>
      {hovered && (
        <button
          onClick={() => onDelete(task.id)}
          className="w-5 h-5 flex items-center justify-center text-zinc-300 hover:text-red-400 transition-colors flex-shrink-0"
          title="Delete task"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}
    </div>
  )
}

export function TodayPanel() {
  const [tasks, setTasks] = useState<DailyTask[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const today = todayDate()
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchTasks = useCallback(async () => {
    const res = await fetch(`/api/tasks?date=${today}`)
    if (res.ok) setTasks(await res.json())
  }, [today])

  useEffect(() => {
    fetchTasks()
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
        body: JSON.stringify({ rawInput: raw, date: today }),
      })
      if (res.ok) {
        const task = (await res.json()) as DailyTask
        setTasks((prev) => {
          const next = [...prev, task]
          return next.sort((a, b) => {
            if (!a.startAt && !b.startAt) return 0
            if (!a.startAt) return 1
            if (!b.startAt) return -1
            return a.startAt.localeCompare(b.startAt)
          })
        })
      }
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [input, today])

  const handleComplete = useCallback(async (id: string, completed: boolean) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completedAt: completed ? new Date() : null } : t)),
    )
    await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    })
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
  }, [])

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-full">
      <div className="px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {formatDate(today)}
        </h1>
      </div>

      <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
            placeholder='Add a task… (e.g. "gym 9am 1hr")'
            disabled={loading}
            className="flex-1 text-sm bg-transparent border-none outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600"
          />
          {loading && (
            <span className="text-xs text-zinc-400">parsing…</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 && !loading && (
          <p className="px-6 py-8 text-sm text-zinc-400">
            No tasks yet. Type anything above to add one.
          </p>
        )}
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onComplete={handleComplete}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  )
}
