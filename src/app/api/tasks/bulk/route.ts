import { replaceDailyTasksForDate, updateDailyTask } from '@/lib/db'
import { createCalendarEvent, deleteCalendarEvent } from '@/lib/macos'
import { NextResponse } from 'next/server'

interface TaskInput {
  rawInput: string
  title: string
  startAt: string | null
  durationMinutes: number
}

export async function PUT(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date param required (YYYY-MM-DD)' }, { status: 400 })
  }

  const body = (await req.json()) as { tasks?: TaskInput[] }
  if (!Array.isArray(body.tasks)) {
    return NextResponse.json({ error: 'tasks array is required' }, { status: 400 })
  }

  const { deletedCalendarEventIds, created } = await replaceDailyTasksForDate(date, body.tasks)

  for (const uid of deletedCalendarEventIds) deleteCalendarEvent(uid)

  const withEvents = await Promise.all(
    created.map(async (task) => {
      const eventId = createCalendarEvent(task.title, task.date, task.startAt, task.durationMinutes)
      if (eventId) {
        await updateDailyTask(task.id, { calendarEventId: eventId })
        return { ...task, calendarEventId: eventId }
      }
      return task
    }),
  )

  return NextResponse.json(withEvents)
}
