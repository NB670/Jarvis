import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateReminderRecord = vi.fn()
const mockCreateDailyTask = vi.fn()
const mockCreateReminder = vi.fn()

vi.mock('@/lib/db', () => ({
  createReminderRecord: mockCreateReminderRecord,
  createDailyTask: mockCreateDailyTask,
}))

vi.mock('@/lib/macos/reminders', () => ({
  createReminder: mockCreateReminder,
}))

describe('set_reminder tool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockCreateReminder.mockReturnValue('apple-id-1')
    mockCreateReminderRecord.mockResolvedValue({ id: 'rem-1', title: 'Call dentist', dueAt: new Date('2026-06-01T14:00:00'), reminderId: 'apple-id-1' })
    mockCreateDailyTask.mockResolvedValue({ id: 't1' })
  })

  it('creates a DailyTask linked to the reminder', async () => {
    const { remindersTool } = await import('@/lib/jarvis/tools/reminders')
    await remindersTool.handle({ title: 'Call dentist', due_at: '2026-06-01T14:00:00' })
    expect(mockCreateDailyTask).toHaveBeenCalledWith(expect.objectContaining({
      date: '2026-06-01',
      title: 'Call dentist',
      type: 'todo',
      startAt: '14:00',
      reminderId: 'rem-1',
    }))
  })

  it('defaults startAt to 06:00 when due time is midnight (no specific time)', async () => {
    mockCreateReminderRecord.mockResolvedValue({ id: 'rem-2', title: 'Pay bills', dueAt: new Date('2026-06-05T00:00:00'), reminderId: 'apple-id-2' })
    const { remindersTool } = await import('@/lib/jarvis/tools/reminders')
    await remindersTool.handle({ title: 'Pay bills', due_at: '2026-06-05T00:00:00' })
    expect(mockCreateDailyTask).toHaveBeenCalledWith(expect.objectContaining({
      date: '2026-06-05',
      startAt: '06:00',
    }))
  })

  it('returns a confirmation string', async () => {
    const { remindersTool } = await import('@/lib/jarvis/tools/reminders')
    const result = await remindersTool.handle({ title: 'Call dentist', due_at: '2026-06-01T14:00:00' })
    expect(typeof result).toBe('string')
    expect(result).toContain('Call dentist')
  })
})
