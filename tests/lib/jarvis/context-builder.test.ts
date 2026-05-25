import { describe, it, expect, vi } from 'vitest'
import { buildContext } from '@/lib/jarvis/context-builder'

vi.mock('@/lib/db', () => ({
  listNotes: vi.fn().mockResolvedValue([
    { id: 'n1', title: '2026 Goals', content: '# 2026 Goals\nLearn Spanish', updatedAt: new Date() },
  ]),
  getMemory: vi.fn().mockResolvedValue({
    goals: [{ title: 'Learn Spanish', horizon: 'long_term', lastEngaged: '2026-05-10' }],
    habits: [{ title: 'Duolingo', frequency: 'daily', lastMentioned: '2026-05-20' }],
    interests: ['guitar'],
    patterns: [],
    keyFacts: [],
    preferences: {},
  }),
  getRecentChatMessages: vi.fn().mockResolvedValue([]),
  getUpcomingCalendarEvents: vi.fn().mockResolvedValue([
    { id: 'c1', title: 'Team call', startAt: new Date('2026-05-26T10:00:00Z'), endAt: new Date('2026-05-26T11:00:00Z') },
  ]),
}))

describe('buildContext', () => {
  it('returns a context object with system prompt, messages, and memory text', async () => {
    const ctx = await buildContext([])
    expect(ctx.systemPrompt).toContain('Jarvis')
    expect(ctx.memoryText).toContain('Learn Spanish')
    expect(ctx.memoryText).toContain('Duolingo')
    expect(ctx.memoryText).toContain('Team call')
    expect(ctx.memoryText).toContain('2026 Goals')
  })

  it('includes provided messages in the output', async () => {
    const ctx = await buildContext([{ role: 'user', content: 'Hello' }])
    expect(ctx.messages.some((m) => m.content === 'Hello')).toBe(true)
  })
})
