import { setMemory } from '@/lib/db'
import { chatJson } from '@/lib/llm/client'
import { jarvisMemoryUpdatePrompt } from '@/lib/llm/prompts'
import type { JarvisMemoryData } from '@/lib/llm/types'

export async function updateMemoryAsync(
  currentMemory: JarvisMemoryData,
  userMessage: string,
  assistantReply: string,
): Promise<void> {
  try {
    const prompt = jarvisMemoryUpdatePrompt(
      JSON.stringify(currentMemory, null, 2),
      userMessage,
      assistantReply,
    )
    const raw = await chatJson([{ role: 'user', content: prompt }])
    const updated = JSON.parse(raw) as JarvisMemoryData
    await setMemory(updated)
  } catch (err) {
    console.error('[memory-service] failed to update memory:', err)
  }
}
