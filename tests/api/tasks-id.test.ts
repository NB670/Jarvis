import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpdateDailyTask = vi.fn()
const mockDeleteDailyTask = vi.fn()
const mockGetReminderById = vi.fn()
const mockUpdateReminderRecord = vi.fn()
const mockDeleteReminderRecord = vi.fn()
const mockFindUnique = vi.fn()
const mockCreateCalendarEvent = vi.fn()
const mockDeleteCalendarEvent = vi.fn()
const mockCompleteReminder = vi.fn()
const mockDeleteReminder = vi.fn()

vi.mock('@/lib/db', () => ({
  updateDailyTask: mockUpdateDailyTask,
  deleteDailyTask: mockDeleteDailyTask,
  getReminderById: mockGetReminderById,
  updateReminderRecord: mockUpdateReminderRecord,
  deleteReminderRecord: mockDeleteReminderRecord,
}))

vi.mock('@/lib/macos', () => ({
  createCalendarEvent: mockCreateCalendarEvent,
  deleteCalendarEvent: mockDeleteCalendarEvent,
  completeReminder: mockCompleteReminder,
  deleteReminder: mockDeleteReminder,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { dailyTask: { findUnique: mockFindUnique } },
}))

const baseTask = {
  id: 't1', title: 'Call dentist', date: '2026-06-01', rawInput: 'call dentist',
  type: 'todo', startAt: '06:00', durationMinutes: 30,
  completedAt: null, calendarEventId: null, reminderId: null, createdAt: new Date(),
}

describe('PUT /api/tasks/:id — reminderId field', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules() })

  it('updates reminderId when passed as a field', async () => {
    mockFindUnique.mockResolvedValue({ ...baseTask })
    mockUpdateDailyTask.mockResolvedValue({ ...baseTask, reminderId: 'rem-1' })
    const { PUT } = await import('@/app/api/tasks/[id]/route')
    const req = new Request('http://localhost/api/tasks/t1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminderId: 'rem-1' }),
    })
    const res = await PUT(req, { params: Promise.resolve({ id: 't1' }) })
    expect(mockUpdateDailyTask).toHaveBeenCalledWith('t1', expect.objectContaining({ reminderId: 'rem-1' }))
    expect(res.status).toBe(200)
  })

  it('clears reminderId when passed as null', async () => {
    mockFindUnique.mockResolvedValue({ ...baseTask, reminderId: 'rem-1' })
    mockUpdateDailyTask.mockResolvedValue({ ...baseTask, reminderId: null })
    const { PUT } = await import('@/app/api/tasks/[id]/route')
    const req = new Request('http://localhost/api/tasks/t1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminderId: null }),
    })
    await PUT(req, { params: Promise.resolve({ id: 't1' }) })
    expect(mockUpdateDailyTask).toHaveBeenCalledWith('t1', expect.objectContaining({ reminderId: null }))
  })
})

describe('PUT /api/tasks/:id — complete cascades to reminder', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules() })

  it('completes linked reminder when task is completed', async () => {
    const taskWithReminder = { ...baseTask, reminderId: 'rem-1' }
    mockFindUnique.mockResolvedValue(taskWithReminder)
    mockUpdateDailyTask.mockResolvedValue({ ...taskWithReminder, completedAt: new Date() })
    mockGetReminderById.mockResolvedValue({ id: 'rem-1', reminderId: 'apple-id-1' })
    mockUpdateReminderRecord.mockResolvedValue({})
    const { PUT } = await import('@/app/api/tasks/[id]/route')
    const req = new Request('http://localhost/api/tasks/t1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    })
    await PUT(req, { params: Promise.resolve({ id: 't1' }) })
    expect(mockUpdateReminderRecord).toHaveBeenCalledWith('rem-1', expect.objectContaining({ completedAt: expect.any(Date) }))
    expect(mockCompleteReminder).toHaveBeenCalledWith('apple-id-1')
  })

  it('skips reminder cascade when task has no reminderId', async () => {
    mockFindUnique.mockResolvedValue({ ...baseTask, reminderId: null })
    mockUpdateDailyTask.mockResolvedValue({ ...baseTask, completedAt: new Date() })
    const { PUT } = await import('@/app/api/tasks/[id]/route')
    const req = new Request('http://localhost/api/tasks/t1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true }),
    })
    await PUT(req, { params: Promise.resolve({ id: 't1' }) })
    expect(mockUpdateReminderRecord).not.toHaveBeenCalled()
    expect(mockCompleteReminder).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/tasks/:id — cascades to linked reminder', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules() })

  it('deletes linked reminder when task is deleted', async () => {
    const taskWithReminder = { ...baseTask, reminderId: 'rem-1' }
    mockFindUnique.mockResolvedValue(taskWithReminder)
    mockGetReminderById.mockResolvedValue({ id: 'rem-1', reminderId: 'apple-id-1' })
    mockDeleteReminderRecord.mockResolvedValue({})
    mockDeleteDailyTask.mockResolvedValue({})
    const { DELETE } = await import('@/app/api/tasks/[id]/route')
    const req = new Request('http://localhost/api/tasks/t1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ id: 't1' }) })
    expect(mockDeleteReminder).toHaveBeenCalledWith('apple-id-1')
    expect(mockDeleteReminderRecord).toHaveBeenCalledWith('rem-1')
    expect(res.status).toBe(204)
  })
})
