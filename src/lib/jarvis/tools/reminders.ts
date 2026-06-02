import { createDailyTask, createReminderRecord } from '@/lib/db'
import { createReminder } from '@/lib/macos/reminders'
import type { JarvisTool } from './types'

interface Args {
  title: string
  due_at: string
  notes?: string
}

async function handle(args: Args): Promise<string> {
  const dueAt = new Date(args.due_at)

  const appleReminderId = createReminder(args.title, dueAt, args.notes)
  const reminder = await createReminderRecord({
    title: args.title,
    dueAt,
    notes: args.notes,
    reminderId: appleReminderId ?? undefined,
  })

  const date = `${dueAt.getFullYear()}-${String(dueAt.getMonth() + 1).padStart(2, '0')}-${String(dueAt.getDate()).padStart(2, '0')}`
  const hours = dueAt.getHours()
  const minutes = dueAt.getMinutes()
  const startAt = (hours === 0 && minutes === 0)
    ? '06:00'
    : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

  await createDailyTask({
    date,
    rawInput: args.title,
    title: args.title,
    type: 'todo',
    startAt,
    durationMinutes: 30,
    reminderId: reminder.id,
  })

  const label = dueAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const timeStr = (hours !== 0 || minutes !== 0)
    ? ` at ${dueAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : ''
  return `Reminder set: "${args.title}" on ${label}${timeStr}.`
}

export const remindersTool: JarvisTool = {
  name: 'set_reminder',
  definition: {
    type: 'function',
    function: {
      name: 'set_reminder',
      description: 'Create a reminder or deadline for the user. Call this when the user mentions a deadline, wants to be reminded of something, or sets a due date for a goal or task.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short, clear reminder title' },
          due_at: { type: 'string', description: 'ISO 8601 datetime string (e.g. 2026-06-05T09:00:00). Use midnight (00:00) if no specific time is given — the task will default to 06:00.' },
          notes: { type: 'string', description: 'Optional extra context or description' },
        },
        required: ['title', 'due_at'],
      },
    },
  },
  handle: (args) => handle(args as Args),
}
