import type { DailyTask } from '@prisma/client'
import { prisma } from '@/lib/prisma'

interface CreateTaskInput {
  date: string
  rawInput: string
  title: string
  type?: string
  startAt: string | null
  durationMinutes: number
  calendarEventId?: string | null
  reminderId?: string | null
}

export async function createDailyTask(input: CreateTaskInput) {
  return prisma.dailyTask.create({ data: input })
}

export async function listDailyTasksForDate(date: string) {
  const tasks = await prisma.dailyTask.findMany({ where: { date } })
  return tasks.sort((a, b) => {
    if (a.startAt === null && b.startAt === null) return 0
    if (a.startAt === null) return 1
    if (b.startAt === null) return -1
    return a.startAt.localeCompare(b.startAt)
  })
}

export async function updateDailyTask(
  id: string,
  data: Partial<{
    completedAt: Date | null
    calendarEventId: string | null
    title: string
    startAt: string | null
    durationMinutes: number
    type: string
    reminderId: string | null
  }>,
) {
  return prisma.dailyTask.update({ where: { id }, data })
}

export async function deleteDailyTask(id: string) {
  return prisma.dailyTask.delete({ where: { id } })
}

export async function replaceDailyTasksForDate(
  date: string,
  tasks: Omit<CreateTaskInput, 'calendarEventId' | 'date'>[],
): Promise<{ deletedCalendarEventIds: string[]; created: DailyTask[] }> {
  const existing = await prisma.dailyTask.findMany({ where: { date } })
  const deletedCalendarEventIds = existing
    .map((t) => t.calendarEventId)
    .filter((id): id is string => id !== null)

  const created = await prisma.$transaction(async (tx) => {
    await tx.dailyTask.deleteMany({ where: { date } })
    return Promise.all(tasks.map((t) => tx.dailyTask.create({ data: { ...t, date } })))
  })

  return { deletedCalendarEventIds, created }
}
