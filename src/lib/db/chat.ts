import { ChatRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function getRecentChatMessages(limit = 20) {
  const rows = await prisma.chatMessage.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
  })
  return rows.reverse()
}

export async function appendChatMessages(
  entries: { role: 'user' | 'assistant'; content: string }[],
) {
  await prisma.chatMessage.createMany({
    data: entries.map((e) => ({
      role: e.role === 'user' ? ChatRole.user : ChatRole.assistant,
      content: e.content,
    })),
  })
}
