import { getMemory, getRecentChatMessages, getUpcomingCalendarEvents, listNotes, listDailyTasksForDate, listUpcomingReminders } from '@/lib/db'
import { jarvisChatSystemPrompt } from '@/lib/llm/prompts'
import type { ChatMessage, JarvisMemoryData } from '@/lib/llm/types'
import type { DailyTask } from '@prisma/client'

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

import type { Reminder } from '@prisma/client'

function formatMemory(
  mem: JarvisMemoryData,
  notes: { title: string; content: string }[],
  events: { title: string; startAt: Date }[],
  tasksByDate: Map<string, DailyTask[]>,
  today: string,
  reminders: Reminder[],
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

  const notesWithContent = notes.filter((n) => stripHtml(n.content).trim())
  const notesBlock = notesWithContent.length
    ? notesWithContent
        .map((n) => {
          const plain = stripHtml(n.content).slice(0, 800)
          return `### ${n.title || 'Untitled'}\n${plain}${plain.length === 800 ? '…' : ''}`
        })
        .join('\n\n')
    : '(none)'

  const calendarBlock = events.length
    ? events
        .map((e) => `- ${e.startAt.toISOString().slice(0, 16).replace('T', ' ')}: ${e.title}`)
        .join('\n')
    : '(none)'

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today + 'T12:00:00')
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })

  const tasksBlock = dates
    .map((d) => {
      const dayTasks = tasksByDate.get(d) ?? []
      const label = d === today ? `${d} (today)` : d
      if (!dayTasks.length) return `${label}: (none)`
      const rows = dayTasks
        .map((t) => {
          const time = t.startAt ? `${t.startAt}: ` : ''
          const done = t.completedAt ? ' [✓]' : ''
          return `  - ${time}${t.title} (${t.durationMinutes}min)${done}`
        })
        .join('\n')
      return `${label}:\n${rows}`
    })
    .join('\n')

  const now = new Date()
  const remindersBlock = reminders.length
    ? reminders.map((r) => {
        const daysUntil = Math.ceil((r.dueAt.getTime() - now.getTime()) / 86400000)
        const urgency = daysUntil <= 0 ? ' [OVERDUE]' : daysUntil === 1 ? ' [DUE TOMORROW]' : daysUntil <= 3 ? ` [in ${daysUntil} days]` : ''
        return `- ${r.dueAt.toISOString().slice(0, 10)}: ${r.title}${urgency}${r.notes ? ` — ${r.notes}` : ''}`
      }).join('\n')
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
    '',
    'SCHEDULED TASKS (next 7 days):',
    tasksBlock,
    '',
    'REMINDERS & DEADLINES:',
    remindersBlock,
  ].join('\n')
}

export async function buildContext(extraMessages: ChatMessage[], conversationId?: string) {
  const today = todayDate()
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today + 'T12:00:00')
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })

  const [mem, notes, recentChat, events, reminders, ...taskArrays] = await Promise.all([
    getMemory(),
    listNotes(),
    getRecentChatMessages(20, conversationId),
    getUpcomingCalendarEvents(7),
    listUpcomingReminders(30),
    ...dates.map((d) => listDailyTasksForDate(d)),
  ])

  const tasksByDate = new Map(dates.map((d, i) => [d, taskArrays[i]]))
  const memoryText = formatMemory(mem, notes, events, tasksByDate, today, reminders)

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
