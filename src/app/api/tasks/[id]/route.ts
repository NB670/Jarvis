import { deleteDailyTask, deleteReminderRecord, getReminderById, updateDailyTask, updateReminderRecord } from '@/lib/db'
import { completeReminder, createCalendarEvent, deleteCalendarEvent, deleteReminder } from '@/lib/macos'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json()) as {
    completed?: boolean
    title?: string
    startAt?: string | null
    durationMinutes?: number
    type?: string
    reminderId?: string | null
  }

  try {
    if (body.completed === true) {
      const existing = await prisma.dailyTask.findUnique({ where: { id } })
      const task = await updateDailyTask(id, { completedAt: new Date(), calendarEventId: null })
      if (existing?.calendarEventId) deleteCalendarEvent(existing.calendarEventId)
      if (existing?.reminderId) {
        const reminder = await getReminderById(existing.reminderId)
        await updateReminderRecord(existing.reminderId, { completedAt: new Date() })
        if (reminder?.reminderId) completeReminder(reminder.reminderId)
      }
      return NextResponse.json(task)
    }
    if (body.completed === false) {
      const existing = await prisma.dailyTask.findUnique({ where: { id } })
      const task = await updateDailyTask(id, { completedAt: null })
      if (existing?.type !== 'todo' && !task.calendarEventId) {
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
    const fields: Partial<{
      title: string
      startAt: string | null
      durationMinutes: number
      type: string
      reminderId: string | null
    }> = {}
    if (typeof body.title === 'string') fields.title = body.title
    if ('startAt' in body) fields.startAt = body.startAt ?? null
    if (typeof body.durationMinutes === 'number') fields.durationMinutes = body.durationMinutes
    if (body.type === 'block' || body.type === 'todo') fields.type = body.type
    if ('reminderId' in body) fields.reminderId = body.reminderId ?? null
    if (Object.keys(fields).length > 0) {
      const existing = await prisma.dailyTask.findUnique({ where: { id } })
      const task = await updateDailyTask(id, fields)
      const effectiveType = fields.type ?? existing?.type ?? 'block'
      if (effectiveType === 'todo') {
        if (existing?.calendarEventId) {
          deleteCalendarEvent(existing.calendarEventId)
          await updateDailyTask(id, { calendarEventId: null })
        }
      } else {
        if (existing?.calendarEventId) deleteCalendarEvent(existing.calendarEventId)
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
    if (task.reminderId) {
      const reminder = await getReminderById(task.reminderId)
      if (reminder?.reminderId) deleteReminder(reminder.reminderId)
      await deleteReminderRecord(task.reminderId)
    }
    await deleteDailyTask(id)
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
