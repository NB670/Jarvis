import { getMemory, setMemory } from '@/lib/db'
import { chatJson } from '@/lib/llm/client'
import { jarvisMemoryUpdatePrompt, notesMemoryUpdatePrompt } from '@/lib/llm/prompts'
import type { JarvisMemoryData } from '@/lib/llm/types'

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function updateMemoryFromNote(
  noteTitle: string,
  noteContent: string,
): Promise<void> {
  try {
    const current = await getMemory()
    const plainText = stripHtml(noteContent)
    if (!plainText.trim()) return

    const prompt = notesMemoryUpdatePrompt(
      JSON.stringify(current, null, 2),
      noteTitle || 'Untitled',
      plainText,
    )
    const raw = await chatJson([{ role: 'user', content: prompt }])
    const updated = JSON.parse(raw) as JarvisMemoryData
    await setMemory(updated)
  } catch (err) {
    console.error('[memory-service] failed to update memory from note:', err)
  }
}

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
