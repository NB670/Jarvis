import { prisma } from '@/lib/prisma'

export async function listUpcomingReminders(limit = 50) {
  return prisma.reminder.findMany({
    where: { completedAt: null },
    orderBy: { dueAt: 'asc' },
    take: limit,
  })
}

export async function createReminderRecord(data: {
  title: string
  dueAt: Date
  notes?: string
  reminderId?: string
}) {
  return prisma.reminder.create({ data })
}

export async function updateReminderRecord(id: string, data: {
  title?: string
  dueAt?: Date
  notes?: string
  reminderId?: string
  completedAt?: Date | null
}) {
  return prisma.reminder.update({ where: { id }, data })
}

export async function deleteReminderRecord(id: string) {
  return prisma.reminder.delete({ where: { id } })
}

export async function getReminderById(id: string) {
  return prisma.reminder.findUnique({ where: { id } })
}
