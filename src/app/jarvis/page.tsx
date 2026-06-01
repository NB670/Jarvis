import { getMemory, getRecentChatMessages } from '@/lib/db'
import { JarvisClient } from '@/components/jarvis/JarvisClient'
import { ChatRole } from '@prisma/client'

export const dynamic = 'force-dynamic'

export default async function JarvisPage() {
  const [initialMemory, rawMessages] = await Promise.all([
    getMemory(),
    getRecentChatMessages(200),
  ])

  const initialMessages = rawMessages.map((m) => ({
    role: m.role === ChatRole.user ? ('user' as const) : ('assistant' as const),
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }))

  return <JarvisClient initialMemory={initialMemory} initialMessages={initialMessages} />
}
