import { createReminderRecord } from '@/lib/db'
import { createReminder } from '@/lib/macos/reminders'
import type { JarvisTool } from './types'

interface Args {
  title: string
  due_at: string
  notes?: string
}

async function handle(args: Args): Promise<string> {
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
          due_at: { type: 'string', description: 'ISO 8601 datetime string (e.g. 2026-06-05T09:00:00). Use noon (12:00) if no specific time is given.' },
          notes: { type: 'string', description: 'Optional extra context or description' },
        },
        required: ['title', 'due_at'],
      },
    },
  },
  handle: (args) => handle(args as Args),
}
