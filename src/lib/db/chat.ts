import { ChatRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function listConversations() {
  return prisma.conversation.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      createdAt: true,
    },
  })
}

export async function createConversation(title = 'New conversation') {
  return prisma.conversation.create({ data: { title } })
}

export async function deleteConversation(id: string) {
  return prisma.conversation.delete({ where: { id } })
}

export async function updateConversationTitle(id: string, title: string) {
  await prisma.conversation.update({ where: { id }, data: { title } })
}

export async function getRecentChatMessages(limit = 20, conversationId?: string) {
  const rows = await prisma.chatMessage.findMany({
    take: limit,
    where: conversationId ? { conversationId } : {},
    orderBy: { createdAt: 'desc' },
  })
  return rows.reverse()
}

export async function getConversationMessages(conversationId: string) {
  return prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, role: true, content: true, createdAt: true },
  })
}

export async function appendChatMessages(
  entries: { role: 'user' | 'assistant'; content: string }[],
  conversationId: string,
) {
  await prisma.chatMessage.createMany({
    data: entries.map((e) => ({
      role: e.role === 'user' ? ChatRole.user : ChatRole.assistant,
      content: e.content,
      conversationId,
    })),
  })
}
