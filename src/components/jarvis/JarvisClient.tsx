'use client'

import type { JarvisMemoryData } from '@/lib/llm/types'
import { useState } from 'react'
import { ChatInterface } from './ChatInterface'
import { MemoryView } from './MemoryView'

type Tab = 'jarvis' | 'memory'

interface Props {
  initialMemory: JarvisMemoryData
}

export function JarvisClient({ initialMemory }: Props) {
  const [tab, setTab] = useState<Tab>('jarvis')

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-zinc-950">
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-4">
        {(['jarvis', 'memory'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'border-b-2 border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            {t === 'jarvis' ? 'Jarvis' : 'Memory'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {tab === 'jarvis' ? <ChatInterface /> : <MemoryView initialMemory={initialMemory} />}
      </div>
    </div>
  )
}
