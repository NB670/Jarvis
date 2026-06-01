import { createReminderRecord, listRemindersForToday, listUpcomingReminders } from '@/lib/db'
import { createReminder } from '@/lib/macos'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('today') === '1') {
    const reminders = await listRemindersForToday()
    return NextResponse.json(reminders)
  }
  const reminders = await listUpcomingReminders()
  return NextResponse.json(reminders)
}

export async function POST(req: Request) {
  const body = await req.json() as { title: string; dueAt: string; notes?: string }
  if (!body.title || !body.dueAt) {
    return NextResponse.json({ error: 'title and dueAt are required' }, { status: 400 })
  }
  const dueAt = new Date(body.dueAt)

  const reminderId = createReminder(body.title, dueAt, body.notes)
  const reminder = await createReminderRecord({
    title: body.title,
    dueAt,
    notes: body.notes,
    reminderId: reminderId ?? undefined,
  })

  return NextResponse.json(reminder, { status: 201 })
}
