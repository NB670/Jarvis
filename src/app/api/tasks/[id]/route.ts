import { deleteDailyTask, updateDailyTask } from '@/lib/db'
import { createCalendarEvent, deleteCalendarEvent } from '@/lib/calendar/applescript'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json()) as {
    completed?: boolean
    title?: string
    startAt?: string | null
    durationMinutes?: number
  }

  try {
    if (body.completed === true) {
      const existing = await prisma.dailyTask.findUnique({ where: { id } })
      const task = await updateDailyTask(id, { completedAt: new Date(), calendarEventId: null })
      if (existing?.calendarEventId) deleteCalendarEvent(existing.calendarEventId)
      return NextResponse.json(task)
    }
    if (body.completed === false) {
      const task = await updateDailyTask(id, { completedAt: null })
      // Recreate calendar event if the task has a time
      if (!task.calendarEventId) {
        try {
          const eventId = createCalendarEvent(task.title, task.date, task.startAt, task.durationMinutes)
          if (eventId) {
            const updated = await updateDailyTask(id, { calendarEventId: eventId })
            return NextResponse.json(updated)
          }
        } catch { /* calendar unavailable */ }
      }
      return NextResponse.json(task)
    }
    // Field edits
    const fields: Record<string, unknown> = {}
    if (typeof body.title === 'string') fields.title = body.title
    if ('startAt' in body) fields.startAt = body.startAt ?? null
    if (typeof body.durationMinutes === 'number') fields.durationMinutes = body.durationMinutes
    if (Object.keys(fields).length > 0) {
      const existing = await prisma.dailyTask.findUnique({ where: { id } })
      const task = await updateDailyTask(id, fields)
      // Sync calendar: delete old event and recreate with updated values
      if (existing?.calendarEventId) deleteCalendarEvent(existing.calendarEventId)
      try {
        const eventId = createCalendarEvent(task.title, task.date, task.startAt, task.durationMinutes)
        if (eventId) {
          const updated = await updateDailyTask(id, { calendarEventId: eventId })
          return NextResponse.json(updated)
        }
      } catch { /* calendar unavailable */ }
      return NextResponse.json(task)
    }
    return NextResponse.json({ error: 'no valid fields' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const task = await prisma.dailyTask.findUnique({ where: { id } })
    if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (task.calendarEventId) deleteCalendarEvent(task.calendarEventId)
    await deleteDailyTask(id)
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
