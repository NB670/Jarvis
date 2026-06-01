import { appendChatMessages, createConversation, getRecentChatMessages, updateConversationTitle, replaceDailyTasksForDate, updateDailyTask, createReminderRecord } from '@/lib/db'
import { createCalendarEvent, deleteCalendarEvent, createReminder } from '@/lib/calendar/applescript'
import { chat } from '@/lib/llm/client'
import { buildContext } from './context-builder'
import { updateMemoryAsync } from './memory-service'

const SET_DAILY_TASKS_TOOL = {
  type: 'function',
  function: {
    name: 'set_daily_tasks',
    description: "Replace the user's task list for a given day. Call this when the user asks to plan their day, schedule tasks, or update their task list.",
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              rawInput: { type: 'string', description: 'Natural language description of the task' },
              title: { type: 'string', description: 'Short, clean task title' },
              startAt: { type: 'string', nullable: true, description: '24-hour HH:MM format, or null if no specific time' },
              durationMinutes: { type: 'number', description: 'Duration in minutes' },
            },
            required: ['rawInput', 'title', 'durationMinutes'],
          },
        },
      },
      required: ['date', 'tasks'],
    },
  },
}

const SET_REMINDER_TOOL = {
  type: 'function',
  function: {
    name: 'set_reminder',
    description: "Create a reminder or deadline for the user. Call this when the user mentions a deadline, wants to be reminded of something, or sets a due date for a goal or task.",
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short, clear reminder title' },
        due_at: { type: 'string', description: 'ISO 8601 datetime string (e.g. 2026-06-05T09:00:00). Use noon (12:00) if no specific time is given.' },
        notes: { type: 'string', description: 'Optional extra context or description' },
      },
      required: ['title', 'due_at'],
    },
  },
}

interface SetReminderArgs {
  title: string
  due_at: string
  notes?: string
}

async function handleSetReminder(args: SetReminderArgs): Promise<string> {
  const dueAt = new Date(args.due_at)
  const reminderId = createReminder(args.title, dueAt, args.notes)
  await createReminderRecord({
    title: args.title,
    dueAt,
    notes: args.notes,
    reminderId: reminderId ?? undefined,
  })
  const label = dueAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const time = dueAt.getHours() !== 12 || dueAt.getMinutes() !== 0
    ? ` at ${dueAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : ''
  return `Reminder set: "${args.title}" on ${label}${time}.`
}

interface SetDailyTasksArgs {
  date: string
  tasks: Array<{
    rawInput: string
    title: string
    startAt: string | null
    durationMinutes: number
  }>
}

async function handleSetDailyTasks(args: SetDailyTasksArgs): Promise<string> {
  const { date, tasks } = args
  const { deletedCalendarEventIds, created } = await replaceDailyTasksForDate(date, tasks)

  for (const uid of deletedCalendarEventIds) deleteCalendarEvent(uid)

  await Promise.allSettled(
    created.map(async (task) => {
      try {
        const eventId = createCalendarEvent(task.title, task.date, task.startAt, task.durationMinutes)
        if (eventId) await updateDailyTask(task.id, { calendarEventId: eventId })
      } catch {
        /* ignore */
      }
    }),
  )

  return `Scheduled ${tasks.length} task${tasks.length !== 1 ? 's' : ''} for ${date}.`
}

export async function runJarvisChat(userText: string, imageDataUrls: string[] = [], conversationId?: string) {
  // Create a new conversation if one wasn't provided
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
    extraTools: [SET_DAILY_TASKS_TOOL, SET_REMINDER_TOOL],
    onExtraToolCall: async (name, args) => {
      if (name === 'set_daily_tasks') return handleSetDailyTasks(args as SetDailyTasksArgs)
      if (name === 'set_reminder') return handleSetReminder(args as SetReminderArgs)
      return `Unknown tool: ${name}`
    },
  })

  await appendChatMessages([
    { role: 'user', content: userText },
    { role: 'assistant', content: reply },
  ], convId)

  // Set title from first user message if this is a new conversation
  if (!conversationId) {
    const title = userText.slice(0, 60).trim()
    updateConversationTitle(convId, title).catch(() => {})
  } else {
    // Check if this is the first message in the conversation
    const existingMessages = await getRecentChatMessages(2, convId)
    if (existingMessages.length <= 2) {
      const title = userText.slice(0, 60).trim()
      updateConversationTitle(convId, title).catch(() => {})
    }
  }

  updateMemoryAsync(ctx.memory, userText, reply)

  return { message: reply, conversationId: convId }
}
