import { prisma } from '@/lib/prisma'

export async function getUpcomingCalendarEvents(days = 7) {
  const now = new Date()
  const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
  return prisma.calendarEvent.findMany({
    where: { startAt: { gte: now, lte: until } },
    orderBy: { startAt: 'asc' },
  })
}

export async function upsertCalendarEvent(event: {
  externalId: string
  title: string
  startAt: Date
  endAt: Date
}) {
  return prisma.calendarEvent.upsert({
    where: { externalId: event.externalId },
    create: { ...event, syncedAt: new Date() },
    update: { ...event, syncedAt: new Date() },
  })
}
