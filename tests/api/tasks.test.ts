import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateDailyTask = vi.fn()
const mockUpdateDailyTask = vi.fn()
const mockListDailyTasksForDate = vi.fn()
const mockCreateCalendarEvent = vi.fn()
const mockChatJson = vi.fn()

vi.mock('@/lib/db', () => ({
  createDailyTask: mockCreateDailyTask,
  updateDailyTask: mockUpdateDailyTask,
  listDailyTasksForDate: mockListDailyTasksForDate,
}))

vi.mock('@/lib/macos', () => ({
  createCalendarEvent: mockCreateCalendarEvent,
}))

vi.mock('@/lib/llm/client', () => ({
  chatJson: mockChatJson,
}))

vi.mock('@/lib/llm/prompts', () => ({
  parseTaskPrompt: vi.fn().mockReturnValue('parse prompt'),
}))

const baseTask = {
  id: 't1',
  title: 'Test task',
  date: '2026-06-01',
  rawInput: 'test',
  completedAt: null,
  calendarEventId: null,
  reminderId: null,
  startAt: '09:00',
  durationMinutes: 60,
  createdAt: new Date(),
}

describe('POST /api/tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockChatJson.mockResolvedValue(JSON.stringify({ title: 'Test task', startAt: '09:00', durationMinutes: 60 }))
    mockCreateCalendarEvent.mockReturnValue('cal-1')
    mockUpdateDailyTask.mockResolvedValue({ ...baseTask, type: 'block', calendarEventId: 'cal-1' })
  })

  it('creates a calendar event for a block task', async () => {
    mockCreateDailyTask.mockResolvedValue({ ...baseTask, type: 'block' })
    const { POST } = await import('@/app/api/tasks/route')
    const req = new Request('http://localhost/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawInput: 'test', date: '2026-06-01', type: 'block' }),
    })
    await POST(req)
    expect(mockCreateCalendarEvent).toHaveBeenCalledOnce()
  })

  it('skips calendar event for a todo task', async () => {
    mockCreateDailyTask.mockResolvedValue({ ...baseTask, type: 'todo', startAt: null })
    const { POST } = await import('@/app/api/tasks/route')
    const req = new Request('http://localhost/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawInput: 'test', date: '2026-06-01', type: 'todo' }),
    })
    await POST(req)
    expect(mockCreateCalendarEvent).not.toHaveBeenCalled()
  })

  it('passes reminderId to createDailyTask when provided', async () => {
    mockChatJson.mockResolvedValue(JSON.stringify({ title: 'Call dentist', startAt: null, durationMinutes: 30 }))
    mockCreateDailyTask.mockResolvedValue({ ...baseTask, type: 'todo', startAt: '06:00', reminderId: 'rem-1' })
    const { POST } = await import('@/app/api/tasks/route')
    const req = new Request('http://localhost/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawInput: 'call dentist', date: '2026-06-01', type: 'todo' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(mockCreateDailyTask).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'todo', startAt: '06:00' }),
    )
  })
})

describe('POST /api/tasks — todo startAt default', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockChatJson.mockResolvedValue(JSON.stringify({ title: 'Call dentist', startAt: null, durationMinutes: 30 }))
    mockCreateDailyTask.mockResolvedValue({
      ...baseTask,
      type: 'todo',
      startAt: '06:00',
      reminderId: null,
    })
  })

  it('defaults todo startAt to 06:00 when LLM returns null', async () => {
    const { POST } = await import('@/app/api/tasks/route')
    const req = new Request('http://localhost/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawInput: 'call dentist', date: '2026-06-01', type: 'todo' }),
    })
    await POST(req)
    expect(mockCreateDailyTask).toHaveBeenCalledWith(
      expect.objectContaining({ startAt: '06:00', type: 'todo' }),
    )
  })

  it('keeps explicit todo startAt when LLM returns one', async () => {
    mockChatJson.mockResolvedValue(JSON.stringify({ title: 'Call dentist', startAt: '14:00', durationMinutes: 30 }))
    const { POST } = await import('@/app/api/tasks/route')
    const req = new Request('http://localhost/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawInput: 'call dentist 2pm', date: '2026-06-01', type: 'todo' }),
    })
    await POST(req)
    expect(mockCreateDailyTask).toHaveBeenCalledWith(
      expect.objectContaining({ startAt: '14:00', type: 'todo' }),
    )
  })
})
