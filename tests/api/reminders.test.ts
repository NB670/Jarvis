import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockListUpcomingReminders = vi.fn()
const mockListRemindersForToday = vi.fn()
const mockCreateReminderRecord = vi.fn()

vi.mock('@/lib/db', () => ({
  listUpcomingReminders: mockListUpcomingReminders,
  listRemindersForToday: mockListRemindersForToday,
  createReminderRecord: mockCreateReminderRecord,
}))

vi.mock('@/lib/macos', () => ({
  createReminder: vi.fn().mockReturnValue('mac-id-1'),
}))

describe('GET /api/reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns all upcoming reminders by default', async () => {
    mockListUpcomingReminders.mockResolvedValue([{ id: 'r1', title: 'Review PR' }])
    const { GET } = await import('@/app/api/reminders/route')
    const res = await GET(new Request('http://localhost/api/reminders'))
    const data = await res.json()
    expect(mockListUpcomingReminders).toHaveBeenCalledOnce()
    expect(mockListRemindersForToday).not.toHaveBeenCalled()
    expect(data).toHaveLength(1)
  })

  it('returns only today reminders when ?today=1', async () => {
    mockListRemindersForToday.mockResolvedValue([{ id: 'r2', title: 'Submit report' }])
    const { GET } = await import('@/app/api/reminders/route')
    const res = await GET(new Request('http://localhost/api/reminders?today=1'))
    const data = await res.json()
    expect(mockListRemindersForToday).toHaveBeenCalledOnce()
    expect(mockListUpcomingReminders).not.toHaveBeenCalled()
    expect(data).toHaveLength(1)
  })
})
