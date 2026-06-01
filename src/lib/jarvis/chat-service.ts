import { appendChatMessages, createConversation, getRecentChatMessages, updateConversationTitle } from '@/lib/db'
import { chat } from '@/lib/llm/client'
import { buildContext } from './context-builder'
import { updateMemoryAsync } from './memory-service'
import { jarvisTools, handleJarvisToolCall } from './tools'

export async function runJarvisChat(userText: string, imageDataUrls: string[] = [], conversationId?: string) {
  let convId = conversationId
  if (!convId) {
    const conv = await createConversation()
    convId = conv.id
  }

  const userContent = imageDataUrls.length
    ? [
        { type: 'text' as const, text: userText },
        ...imageDataUrls.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
      ]
    : userText

  const ctx = await buildContext([{ role: 'user', content: userContent }], convId)

  const reply = await chat(ctx.messages, {
    extraTools: jarvisTools.map((t) => t.definition),
    onExtraToolCall: handleJarvisToolCall,
  })

  await appendChatMessages([
    { role: 'user', content: userText },
    { role: 'assistant', content: reply },
  ], convId)

  // Set conversation title from first user message
  if (!conversationId) {
    updateConversationTitle(convId, userText.slice(0, 60).trim()).catch(() => {})
  } else {
    const existing = await getRecentChatMessages(2, convId)
    if (existing.length <= 2) {
      updateConversationTitle(convId, userText.slice(0, 60).trim()).catch(() => {})
    }
  }

  updateMemoryAsync(ctx.memory, userText, reply)

  return { message: reply, conversationId: convId }
}
