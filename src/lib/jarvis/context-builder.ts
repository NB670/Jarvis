import { getMemory, getRecentChatMessages, getUpcomingCalendarEvents, listNotes, listDailyTasksForDate } from '@/lib/db'
import { jarvisChatSystemPrompt } from '@/lib/llm/prompts'
import type { ChatMessage, JarvisMemoryData } from '@/lib/llm/types'
import type { DailyTask } from '@prisma/client'

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function formatMemory(
  mem: JarvisMemoryData,
  notes: { title: string; content: string }[],
  events: { title: string; startAt: Date }[],
  tasks: DailyTask[],
  today: string,
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

  const tasksBlock = tasks.length
    ? tasks
        .map((t) => {
          const time = t.startAt ? `${t.startAt}: ` : ''
          const done = t.completedAt ? ' [✓]' : ''
          return `- ${time}${t.title} (${t.durationMinutes}min)${done}`
        })
        .join('\n')
    : '(none scheduled)'

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
    '',
    `TODAY'S TASKS (${today}):`,
    tasksBlock,
  ].join('\n')
}

export async function buildContext(extraMessages: ChatMessage[]) {
  const today = todayDate()
  const [mem, notes, recentChat, events, tasks] = await Promise.all([
    getMemory(),
    listNotes(),
    getRecentChatMessages(20),
    getUpcomingCalendarEvents(7),
    listDailyTasksForDate(today),
  ])

  const memoryText = formatMemory(mem, notes, events, tasks, today)

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
