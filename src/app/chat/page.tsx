import { ChatInterface } from '@/components/jarvis/ChatInterface'
import { getRecentChatMessages } from '@/lib/db'
import { ChatRole } from '@prisma/client'

export const dynamic = 'force-dynamic'

export default async function ChatPage() {
  const raw = await getRecentChatMessages(40)

  const initialMessages = raw.map((m) => ({
    role: m.role === ChatRole.user ? ('user' as const) : ('assistant' as const),
    content: m.content,
  }))

  return (
    <div className="flex flex-col h-screen">
      <ChatInterface initialMessages={initialMessages} />
    </div>
  )
}
