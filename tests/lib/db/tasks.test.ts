import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  createDailyTask,
  listDailyTasksForDate,
  updateDailyTask,
  deleteDailyTask,
  replaceDailyTasksForDate,
} from '@/lib/db/tasks'

beforeEach(async () => {
  await prisma.dailyTask.deleteMany()
})

describe('createDailyTask', () => {
  it('creates a task and returns it', async () => {
    const task = await createDailyTask({
      date: '2026-05-30',
      rawInput: 'gym 9am 1hr',
      title: 'Gym',
      startAt: '09:00',
      durationMinutes: 60,
    })
    expect(task.title).toBe('Gym')
    expect(task.date).toBe('2026-05-30')
    expect(task.startAt).toBe('09:00')
    expect(task.durationMinutes).toBe(60)
    expect(task.completedAt).toBeNull()
    expect(task.calendarEventId).toBeNull()
  })

  it('creates a task with no time', async () => {
    const task = await createDailyTask({
      date: '2026-05-30',
      rawInput: 'write journal',
      title: 'Write journal',
      startAt: null,
      durationMinutes: 30,
    })
    expect(task.startAt).toBeNull()
  })
})

describe('listDailyTasksForDate', () => {
  it('returns only tasks for the given date', async () => {
    await createDailyTask({ date: '2026-05-30', rawInput: 'a', title: 'A', startAt: null, durationMinutes: 30 })
    await createDailyTask({ date: '2026-05-31', rawInput: 'b', title: 'B', startAt: null, durationMinutes: 30 })
    const tasks = await listDailyTasksForDate('2026-05-30')
    expect(tasks).toHaveLength(1)
    expect(tasks[0].title).toBe('A')
  })

  it('returns tasks sorted by startAt ascending, nulls last', async () => {
    await createDailyTask({ date: '2026-05-30', rawInput: 'c', title: 'C', startAt: null, durationMinutes: 30 })
    await createDailyTask({ date: '2026-05-30', rawInput: 'a', title: 'A', startAt: '09:00', durationMinutes: 30 })
    await createDailyTask({ date: '2026-05-30', rawInput: 'b', title: 'B', startAt: '07:00', durationMinutes: 30 })
    const tasks = await listDailyTasksForDate('2026-05-30')
    expect(tasks[0].title).toBe('B')
    expect(tasks[1].title).toBe('A')
    expect(tasks[2].title).toBe('C')
  })
})

describe('updateDailyTask', () => {
  it('marks task as completed', async () => {
    const task = await createDailyTask({ date: '2026-05-30', rawInput: 'gym', title: 'Gym', startAt: null, durationMinutes: 30 })
    const now = new Date()
    const updated = await updateDailyTask(task.id, { completedAt: now })
    expect(updated.completedAt).not.toBeNull()
  })

  it('sets calendarEventId', async () => {
    const task = await createDailyTask({ date: '2026-05-30', rawInput: 'gym', title: 'Gym', startAt: null, durationMinutes: 30 })
    const updated = await updateDailyTask(task.id, { calendarEventId: 'abc-123' })
    expect(updated.calendarEventId).toBe('abc-123')
  })
})

describe('deleteDailyTask', () => {
  it('removes the task', async () => {
    const task = await createDailyTask({ date: '2026-05-30', rawInput: 'gym', title: 'Gym', startAt: null, durationMinutes: 30 })
    await deleteDailyTask(task.id)
    const tasks = await listDailyTasksForDate('2026-05-30')
    expect(tasks).toHaveLength(0)
  })
})

describe('replaceDailyTasksForDate', () => {
  it('replaces all tasks and returns new ones', async () => {
    await createDailyTask({ date: '2026-05-30', rawInput: 'old', title: 'Old', startAt: null, durationMinutes: 30 })
    const { created } = await replaceDailyTasksForDate('2026-05-30', [
      { rawInput: 'gym 9am', title: 'Gym', startAt: '09:00', durationMinutes: 60 },
      { rawInput: 'lunch', title: 'Lunch', startAt: '12:00', durationMinutes: 60 },
    ])
    expect(created).toHaveLength(2)
    const remaining = await listDailyTasksForDate('2026-05-30')
    expect(remaining).toHaveLength(2)
  })

  it('returns old tasks calendarEventIds for cleanup', async () => {
    const old = await createDailyTask({ date: '2026-05-30', rawInput: 'old', title: 'Old', startAt: null, durationMinutes: 30 })
    await updateDailyTask(old.id, { calendarEventId: 'cal-id-1' })
    const { deletedCalendarEventIds } = await replaceDailyTasksForDate('2026-05-30', [])
    expect(deletedCalendarEventIds).toContain('cal-id-1')
  })
})
