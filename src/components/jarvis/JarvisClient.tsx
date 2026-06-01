'use client'

import type { JarvisMemoryData } from '@/lib/llm/types'
import { useState } from 'react'
import { ChatInterface } from './ChatInterface'
import { MemoryView } from './MemoryView'

type Tab = 'chat' | 'memory'

interface Msg {
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
}

interface DayGroup {
  date: string
  label: string
  preview: string
  elementId: string
}

interface Props {
  initialMemory: JarvisMemoryData
  initialMessages: Msg[]
}

function toDateKey(iso: string) {
  return iso.slice(0, 10)
}

function dayLabel(dateKey: string) {
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (dateKey === today) return 'Today'
  if (dateKey === yesterday) return 'Yesterday'
  return new Date(dateKey + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function buildDayGroups(messages: Msg[]): DayGroup[] {
  const seen = new Map<string, string>()
  for (const m of messages) {
    if (!m.createdAt) continue
    const d = toDateKey(m.createdAt)
    if (!seen.has(d) && m.role === 'user') seen.set(d, m.content)
  }
  return Array.from(seen.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, preview]) => ({
      date,
      label: dayLabel(date),
      preview: preview.slice(0, 50),
      elementId: `day-${date}`,
    }))
}

function SidebarTab({ active, onClick, icon, children }: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
          : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}

export function JarvisClient({ initialMemory, initialMessages }: Props) {
  const [tab, setTab] = useState<Tab>('chat')
  const dayGroups = buildDayGroups(initialMessages)

  const scrollToDay = (elementId: string) => {
    document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950">
      {/* Left sidebar */}
      <div className="w-56 flex-shrink-0 flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        <div className="px-3 pt-4 pb-2 space-y-0.5">
          <SidebarTab active={tab === 'chat'} onClick={() => setTab('chat')} icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2h10a1 1 0 011 1v7a1 1 0 01-1 1H4l-3 2V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            </svg>
          }>Chat</SidebarTab>
          <SidebarTab active={tab === 'memory'} onClick={() => setTab('memory')} icon={
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1a6 6 0 100 12A6 6 0 007 1zM7 4v3l2 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }>Memory</SidebarTab>
        </div>

        {tab === 'chat' && dayGroups.length > 0 && (
          <>
            <p className="px-4 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">History</p>
            <div className="flex-1 overflow-y-auto pb-4">
              {dayGroups.map((g) => (
                <button
                  key={g.date}
                  onClick={() => scrollToDay(g.elementId)}
                  className="w-full text-left px-4 py-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group"
                >
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 transition-colors">{g.label}</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-600 truncate mt-0.5">{g.preview}</p>
                </button>
              ))}
            </div>
          </>
        )}

        {tab === 'memory' && <div className="flex-1" />}
      </div>

      {/* Main area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 'chat'
          ? <ChatInterface initialMessages={initialMessages} dayGroups={dayGroups} />
          : <MemoryView initialMemory={initialMemory} />
        }
      </div>
    </div>
  )
}
