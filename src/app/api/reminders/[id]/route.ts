import { deleteReminderRecord, getReminderById, updateReminderRecord } from '@/lib/db'
import { completeReminder, deleteReminder } from '@/lib/macos'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json() as { completedAt?: string | null; title?: string; dueAt?: string; notes?: string }
  const data: Parameters<typeof updateReminderRecord>[1] = {}
  if ('completedAt' in body) data.completedAt = body.completedAt ? new Date(body.completedAt) : null
  if (body.title) data.title = body.title
  if (body.dueAt) data.dueAt = new Date(body.dueAt)
  if ('notes' in body) data.notes = body.notes
  const existing = await getReminderById(id)
  const reminder = await updateReminderRecord(id, data)
  // Sync completion state to Apple Reminders
  if ('completedAt' in body && body.completedAt && existing?.reminderId) {
    completeReminder(existing.reminderId)
  }
  return NextResponse.json(reminder)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const reminder = await getReminderById(id)
  if (reminder?.reminderId) deleteReminder(reminder.reminderId)
  await deleteReminderRecord(id)
  return new NextResponse(null, { status: 204 })
}
