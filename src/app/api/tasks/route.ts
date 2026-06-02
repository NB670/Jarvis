import { createDailyTask, listDailyTasksForDate, updateDailyTask } from '@/lib/db'
import { createCalendarEvent } from '@/lib/macos'
import { chatJson } from '@/lib/llm/client'
import { parseTaskPrompt } from '@/lib/llm/prompts'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date param required (YYYY-MM-DD)' }, { status: 400 })
  }
  const tasks = await listDailyTasksForDate(date)
  return NextResponse.json(tasks)
}

export async function POST(req: Request) {
  const body = (await req.json()) as { rawInput?: string; date?: string; type?: string }
  if (typeof body.rawInput !== 'string' || !body.rawInput.trim()) {
    return NextResponse.json({ error: 'rawInput is required' }, { status: 400 })
  }
  if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return NextResponse.json({ error: 'date is required (YYYY-MM-DD)' }, { status: 400 })
  }

  const taskType = body.type === 'todo' ? 'todo' : 'block'

  const now = new Date()
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  let parsed: { title: string; startAt: string | null; durationMinutes: number }
  try {
    const raw = await chatJson([{ role: 'user', content: parseTaskPrompt(body.rawInput, body.date, currentTime) }])
    parsed = JSON.parse(raw)
  } catch {
    parsed = { title: body.rawInput.trim(), startAt: null, durationMinutes: 30 }
  }

  if (taskType === 'todo') parsed.startAt = parsed.startAt ?? '06:00'

  const task = await createDailyTask({
    date: body.date,
    rawInput: body.rawInput,
    title: parsed.title,
    type: taskType,
    startAt: parsed.startAt,
    durationMinutes: parsed.durationMinutes,
  })

  if (taskType === 'block') {
    const eventId = createCalendarEvent(task.title, task.date, task.startAt, task.durationMinutes)
    if (eventId) {
      await updateDailyTask(task.id, { calendarEventId: eventId })
      return NextResponse.json({ ...task, calendarEventId: eventId }, { status: 201 })
    }
  }

  return NextResponse.json(task, { status: 201 })
}
