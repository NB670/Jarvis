import { appendChatMessages, replaceDailyTasksForDate, updateDailyTask } from '@/lib/db'
import { createCalendarEvent, deleteCalendarEvent } from '@/lib/calendar/applescript'
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

export async function runJarvisChat(userText: string, imageDataUrls: string[] = []) {
  const userContent = imageDataUrls.length
    ? [
        { type: 'text' as const, text: userText },
        ...imageDataUrls.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
      ]
    : userText
  const ctx = await buildContext([{ role: 'user', content: userContent }])

  const reply = await chat(ctx.messages, {
    extraTools: [SET_DAILY_TASKS_TOOL],
    onExtraToolCall: async (name, args) => {
      if (name === 'set_daily_tasks') {
        return handleSetDailyTasks(args as SetDailyTasksArgs)
      }
      return `Unknown tool: ${name}`
    },
  })

  await appendChatMessages([
    { role: 'user', content: userText },
    { role: 'assistant', content: reply },
  ])

  updateMemoryAsync(ctx.memory, userText, reply)

  return { message: reply }
}
