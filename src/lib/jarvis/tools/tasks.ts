import { replaceDailyTasksForDate, updateDailyTask } from '@/lib/db'
import { createCalendarEvent, deleteCalendarEvent } from '@/lib/macos/calendar'
import { deleteReminder } from '@/lib/macos/reminders'
import type { JarvisTool } from './types'

interface Args {
  date: string
  tasks: Array<{
    rawInput: string
    title: string
    startAt: string | null
    durationMinutes: number
  }>
}

async function handle(args: Args): Promise<string> {
  const { date, tasks } = args
  const { deletedCalendarEventIds, deletedAppleReminderIds, created } = await replaceDailyTasksForDate(date, tasks)

  for (const uid of deletedCalendarEventIds) deleteCalendarEvent(uid)
  for (const rid of deletedAppleReminderIds) deleteReminder(rid)

  await Promise.allSettled(
    created.map(async (task) => {
      try {
        const eventId = createCalendarEvent(task.title, task.date, task.startAt, task.durationMinutes)
        if (eventId) await updateDailyTask(task.id, { calendarEventId: eventId })
      } catch { /* ignore */ }
    }),
  )

  return `Scheduled ${tasks.length} task${tasks.length !== 1 ? 's' : ''} for ${date}.`
}

export const tasksTool: JarvisTool = {
  name: 'set_daily_tasks',
  definition: {
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
  },
  handle: (args) => handle(args as Args),
}
