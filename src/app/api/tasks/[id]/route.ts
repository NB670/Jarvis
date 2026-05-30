import { deleteDailyTask, updateDailyTask } from '@/lib/db'
import { deleteCalendarEvent } from '@/lib/calendar/applescript'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json()) as { completed?: boolean }

  try {
    if (body.completed === true) {
      const task = await updateDailyTask(id, { completedAt: new Date() })
      if (task.calendarEventId) deleteCalendarEvent(task.calendarEventId)
      return NextResponse.json(task)
    }
    if (body.completed === false) {
      const task = await updateDailyTask(id, { completedAt: null })
      return NextResponse.json(task)
    }
    return NextResponse.json({ error: 'completed boolean is required' }, { status: 400 })
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
