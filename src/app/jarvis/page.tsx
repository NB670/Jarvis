import { getMemory, listConversations, getConversationMessages } from '@/lib/db'
import { JarvisClient } from '@/components/jarvis/JarvisClient'
import { ChatRole } from '@prisma/client'

export const dynamic = 'force-dynamic'

export default async function JarvisPage() {
  const [initialMemory, conversations] = await Promise.all([
    getMemory(),
    listConversations(),
  ])

  // Load messages for the most recent conversation
  const latestConversation = conversations[0] ?? null
  const rawMessages = latestConversation
    ? await getConversationMessages(latestConversation.id)
    : []

  const initialMessages = rawMessages.map((m) => ({
    role: m.role === ChatRole.user ? ('user' as const) : ('assistant' as const),
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }))

  return (
    <JarvisClient
      initialMemory={initialMemory}
      initialConversations={conversations.map((c) => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt.toISOString(),
      }))}
      initialActiveConversationId={latestConversation?.id ?? null}
      initialMessages={initialMessages}
    />
  )
}
