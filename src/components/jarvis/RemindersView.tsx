'use client'

import { useEffect, useState } from 'react'

interface Reminder {
  id: string
  title: string
  dueAt: string
  notes?: string | null
  completedAt?: string | null
}

function urgencyLabel(dueAt: string): { text: string; className: string } | null {
  const days = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86400000)
  if (days < 0) return { text: 'Overdue', className: 'text-red-500 bg-red-50 dark:bg-red-950/40' }
  if (days === 0) return { text: 'Due today', className: 'text-orange-500 bg-orange-50 dark:bg-orange-950/40' }
  if (days === 1) return { text: 'Tomorrow', className: 'text-amber-500 bg-amber-50 dark:bg-amber-950/40' }
  if (days <= 3) return { text: `${days} days`, className: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/40' }
  return null
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const isNoon = d.getHours() === 12 && d.getMinutes() === 0
  const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (isNoon) return datePart
  return `${datePart} at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

export function RemindersView() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ title: '', dueAt: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/reminders').then((r) => r.json()).then((d) => setReminders(d as Reminder[]))
  }, [])

  const complete = async (id: string) => {
    await fetch(`/api/reminders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completedAt: new Date().toISOString() }),
    })
    setReminders((prev) => prev.filter((r) => r.id !== id))
  }

  const remove = async (id: string) => {
    await fetch(`/api/reminders/${id}`, { method: 'DELETE' })
    setReminders((prev) => prev.filter((r) => r.id !== id))
  }

  const submit = async () => {
    if (!draft.title.trim() || !draft.dueAt) return
    setSaving(true)
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title.trim(),
          dueAt: new Date(draft.dueAt).toISOString(),
          notes: draft.notes.trim() || undefined,
        }),
      })
      const r = await res.json() as Reminder
      setReminders((prev) => [...prev, r].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()))
      setDraft({ title: '', dueAt: '', notes: '' })
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Reminders</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Deadlines and reminders — Jarvis knows about all of these</p>
          </div>
          <button
            onClick={() => setAdding((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-80 transition-opacity"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Add
          </button>
        </div>

        {/* Add form */}
        {adding && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-3 bg-zinc-50 dark:bg-zinc-900">
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Reminder title…"
              className="w-full text-sm bg-transparent outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 border-b border-zinc-200 dark:border-zinc-700 pb-1"
              autoFocus
            />
            <div className="flex items-center gap-3">
              <input
                type="datetime-local"
                value={draft.dueAt}
                onChange={(e) => setDraft((d) => ({ ...d, dueAt: e.target.value }))}
                className="text-sm bg-transparent outline-none text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1"
              />
            </div>
            <input
              type="text"
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              placeholder="Notes (optional)…"
              className="w-full text-sm bg-transparent outline-none text-zinc-600 dark:text-zinc-400 placeholder-zinc-400"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setAdding(false); setDraft({ title: '', dueAt: '', notes: '' }) }}
                className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!draft.title.trim() || !draft.dueAt || saving}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 disabled:opacity-40 transition-opacity"
              >
                {saving ? 'Saving…' : 'Save reminder'}
              </button>
            </div>
          </div>
        )}

        {/* Reminder list */}
        {reminders.length === 0 && !adding ? (
          <p className="text-sm text-zinc-400 text-center py-8">No upcoming reminders. Tell Jarvis "remind me to…" or add one above.</p>
        ) : (
          <div className="space-y-1">
            {reminders.map((r) => {
              const urgency = urgencyLabel(r.dueAt)
              return (
                <div
                  key={r.id}
                  className="flex items-start gap-3 py-2.5 px-1 rounded-lg group hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                >
                  {/* Complete checkbox */}
                  <button
                    onClick={() => complete(r.id)}
                    className="mt-0.5 w-4 h-4 rounded-full border-2 border-zinc-300 dark:border-zinc-600 hover:border-zinc-500 dark:hover:border-zinc-400 flex-shrink-0 transition-colors"
                    title="Mark complete"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-zinc-800 dark:text-zinc-200">{r.title}</span>
                      {urgency && (
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${urgency.className}`}>
                          {urgency.text}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">{formatDate(r.dueAt)}</p>
                    {r.notes && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{r.notes}</p>}
                  </div>
                  {/* Delete */}
                  <button
                    onClick={() => remove(r.id)}
                    className="opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5 text-zinc-300 hover:text-red-400 transition-all"
                    title="Delete"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
