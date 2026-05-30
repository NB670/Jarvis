import { createDailyTask, listDailyTasksForDate } from '@/lib/db'
import { listCalendarEventsForDate } from '@/lib/calendar/applescript'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date param required (YYYY-MM-DD)' }, { status: 400 })
  }

  const [calEvents, existing] = await Promise.all([
    Promise.resolve(listCalendarEventsForDate(date)),
    listDailyTasksForDate(date),
  ])

  const existingCalIds = new Set(existing.map((t) => t.calendarEventId).filter(Boolean))

  await Promise.all(
    calEvents
      .filter((ev) => !existingCalIds.has(ev.uid))
      .map((ev) =>
        createDailyTask({
          date,
          rawInput: ev.title,
          title: ev.title,
          startAt: ev.startAt,
          durationMinutes: ev.durationMinutes,
          calendarEventId: ev.uid,
        }),
      ),
  )

  const tasks = await listDailyTasksForDate(date)
  return NextResponse.json(tasks)
}
