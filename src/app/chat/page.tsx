import { ChatClient } from "@/components/ChatClient"
import { getRecentChatMessages } from "@/lib/db"
import { ChatRole } from "@prisma/client"

export const dynamic = 'force-dynamic'

export default async function ChatPage() {
  const raw = await getRecentChatMessages(40)

  const initialMessages = raw.map((m) => ({
    role: m.role === ChatRole.user ? ("user" as const) : ("assistant" as const),
    content: m.content,
  }))

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Chat
      </h1>
      <ChatClient initialMessages={initialMessages} />
    </main>
  )
}
