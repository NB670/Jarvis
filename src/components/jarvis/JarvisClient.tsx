'use client'

import type { JarvisMemoryData } from '@/lib/llm/types'
import { useCallback, useState } from 'react'
import { ChatInterface } from './ChatInterface'
import { MemoryView } from './MemoryView'

type Tab = 'chat' | 'memory'

interface Conversation {
  id: string
  title: string
  createdAt: string
}

interface Msg {
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
}

interface Props {
  initialMemory: JarvisMemoryData
  initialConversations: Conversation[]
  initialActiveConversationId: string | null
  initialMessages: Msg[]
}

interface ContextMenu {
  conversationId: string
  x: number
  y: number
}

function relativeTime(iso: string) {
  const date = new Date(iso)
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const dateKey = iso.slice(0, 10)
  if (dateKey === today) return 'Today'
  if (dateKey === yesterday) return 'Yesterday'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function JarvisClient({ initialMemory, initialConversations, initialActiveConversationId, initialMessages }: Props) {
  const [tab, setTab] = useState<Tab>('chat')
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(initialActiveConversationId)
  const [messages, setMessages] = useState<Msg[]>(initialMessages)
  const [loadingConv, setLoadingConv] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)

  const switchConversation = useCallback(async (id: string) => {
    if (id === activeConversationId) return
    setLoadingConv(true)
    setActiveConversationId(id)
    setMessages([])
    try {
      const res = await fetch(`/api/conversations/${id}`)
      const data = await res.json() as Msg[]
      setMessages(data.map((m) => ({ ...m, role: m.role as 'user' | 'assistant' })))
    } finally {
      setLoadingConv(false)
    }
  }, [activeConversationId])

  const newConversation = useCallback(async () => {
    const res = await fetch('/api/conversations', { method: 'POST' })
    const conv = await res.json() as Conversation
    setConversations((prev) => [conv, ...prev])
    setActiveConversationId(conv.id)
    setMessages([])
  }, [])

  const deleteConversation = useCallback(async (id: string) => {
    setContextMenu(null)
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
    setConversations((prev) => prev.filter((c) => c.id !== id))
    if (activeConversationId === id) {
      const remaining = conversations.filter((c) => c.id !== id)
      if (remaining.length > 0) {
        await switchConversation(remaining[0].id)
      } else {
        setActiveConversationId(null)
        setMessages([])
      }
    }
  }, [activeConversationId, conversations, switchConversation])

  const handleConversationUpdate = useCallback((id: string, title: string) => {
    setConversations((prev) =>
      prev.map((c) => c.id === id ? { ...c, title } : c)
    )
  }, [])

  const handleRightClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    setContextMenu({ conversationId: id, x: e.clientX, y: e.clientY })
  }

  return (
    <div
      className="flex h-screen bg-white dark:bg-zinc-950"
      onClick={() => setContextMenu(null)}
    >
      {/* Left sidebar */}
      <div className="w-56 flex-shrink-0 flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
        {/* Nav tabs */}
        <div className="px-3 pt-4 pb-2 space-y-0.5">
          <button
            onClick={() => setTab('chat')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'chat'
                ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2h10a1 1 0 011 1v7a1 1 0 01-1 1H4l-3 2V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
            </svg>
            Chat
          </button>
          <button
            onClick={() => setTab('memory')}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'memory'
                ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1a6 6 0 100 12A6 6 0 007 1zM7 4v3l2 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Memory
          </button>
        </div>

        {tab === 'chat' && (
          <>
            {/* New conversation button */}
            <div className="px-3 pb-2">
              <button
                onClick={newConversation}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 border border-dashed border-zinc-200 dark:border-zinc-700 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                New conversation
              </button>
            </div>

            {/* Conversation list */}
            {conversations.length > 0 && (
              <>
                <p className="px-4 pt-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Conversations</p>
                <div className="flex-1 overflow-y-auto pb-4">
                  {conversations.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => switchConversation(c.id)}
                      onContextMenu={(e) => handleRightClick(e, c.id)}
                      className={`w-full text-left px-4 py-2.5 transition-colors group ${
                        activeConversationId === c.id
                          ? 'bg-zinc-200 dark:bg-zinc-700'
                          : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <p className={`text-xs font-medium truncate transition-colors ${
                        activeConversationId === c.id
                          ? 'text-zinc-900 dark:text-zinc-100'
                          : 'text-zinc-600 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-100'
                      }`}>
                        {c.title === 'New conversation' ? 'New conversation' : c.title}
                      </p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-0.5">{relativeTime(c.createdAt)}</p>
                    </button>
                  ))}
                </div>
              </>
            )}

            {conversations.length === 0 && <div className="flex-1" />}
          </>
        )}

        {tab === 'memory' && <div className="flex-1" />}
      </div>

      {/* Main area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 'chat'
          ? (
            <ChatInterface
              key={activeConversationId ?? 'empty'}
              conversationId={activeConversationId}
              initialMessages={messages}
              loading={loadingConv}
              onConversationCreated={(id, title) => {
                setActiveConversationId(id)
                setConversations((prev) => {
                  if (prev.find((c) => c.id === id)) {
                    return prev.map((c) => c.id === id ? { ...c, title } : c)
                  }
                  return [{ id, title, createdAt: new Date().toISOString() }, ...prev]
                })
                handleConversationUpdate(id, title)
              }}
            />
          )
          : <MemoryView initialMemory={initialMemory} />
        }
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => deleteConversation(contextMenu.conversationId)}
            className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          >
            Delete conversation
          </button>
        </div>
      )}
    </div>
  )
}
