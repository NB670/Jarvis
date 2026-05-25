import { appendChatMessages } from '@/lib/db'
import { chat } from '@/lib/llm/client'
import { buildContext } from './context-builder'
import { updateMemoryAsync } from './memory-service'

export async function runJarvisChat(userText: string) {
  const ctx = await buildContext([{ role: 'user', content: userText }])
  const reply = await chat(ctx.messages)

  await appendChatMessages([
    { role: 'user', content: userText },
    { role: 'assistant', content: reply },
  ])

  updateMemoryAsync(ctx.memory, userText, reply)

  return { message: reply }
}
