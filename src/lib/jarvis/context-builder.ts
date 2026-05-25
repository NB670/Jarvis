import { getMemory, getRecentChatMessages, getUpcomingCalendarEvents, listNotes } from '@/lib/db'
import { jarvisChatSystemPrompt } from '@/lib/llm/prompts'
import type { ChatMessage, JarvisMemoryData } from '@/lib/llm/types'

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function formatMemory(
  mem: JarvisMemoryData,
  notes: { title: string; content: string }[],
  events: { title: string; startAt: Date }[],
): string {
  const goalsBlock = mem.goals.length
    ? mem.goals
        .map(
          (g) =>
            `- [${g.horizon}/${g.priority ?? 'medium'}] ${g.title}${g.target ? ` — ${g.target}` : ''}${g.lastEngaged ? ` (last engaged: ${g.lastEngaged})` : ''}`,
        )
        .join('\n')
    : '(none)'

  const habitsBlock = mem.habits.length
    ? mem.habits
        .map(
          (h) =>
            `- ${h.title}${h.frequency ? ` (${h.frequency})` : ''}${h.lastMentioned ? `, last mentioned: ${h.lastMentioned}` : ''}`,
        )
        .join('\n')
    : '(none)'

  const notesBlock = notes.length
    ? notes
        .map((n) => {
          const plain = stripHtml(n.content).slice(0, 800)
          return `### ${n.title}\n${plain}${plain.length === 800 ? '…' : ''}`
        })
        .join('\n\n')
    : '(none)'

  const calendarBlock = events.length
    ? events
        .map((e) => `- ${e.startAt.toISOString().slice(0, 16).replace('T', ' ')}: ${e.title}`)
        .join('\n')
    : '(none)'

  return [
    'GOALS:',
    goalsBlock,
    '',
    'HABITS:',
    habitsBlock,
    '',
    'INTERESTS: ' + (mem.interests.join(', ') || '(none)'),
    '',
    'KEY FACTS: ' + (mem.keyFacts.join('; ') || '(none)'),
    '',
    'NOTES:',
    notesBlock,
    '',
    'UPCOMING CALENDAR (next 7 days):',
    calendarBlock,
  ].join('\n')
}

export async function buildContext(extraMessages: ChatMessage[]) {
  const [mem, notes, recentChat, events] = await Promise.all([
    getMemory(),
    listNotes(),
    getRecentChatMessages(20),
    getUpcomingCalendarEvents(7),
  ])

  const memoryText = formatMemory(mem, notes, events)

  const systemPrompt = `${jarvisChatSystemPrompt()}\n\nMEMORY_CONTEXT:\n${memoryText}`

  const historyMessages: ChatMessage[] = recentChat.map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }))

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    ...extraMessages,
  ]

  return { systemPrompt, memoryText, messages, memory: mem }
}
