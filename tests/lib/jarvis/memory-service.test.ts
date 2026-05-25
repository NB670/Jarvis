import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockChatJson, mockSetMemory } = vi.hoisted(() => ({
  mockChatJson: vi.fn(),
  mockSetMemory: vi.fn(),
}))

vi.mock('@/lib/llm/client', () => ({ chatJson: mockChatJson }))
vi.mock('@/lib/db', () => ({ setMemory: mockSetMemory }))

import { updateMemoryAsync } from '@/lib/jarvis/memory-service'
import type { JarvisMemoryData } from '@/lib/llm/types'

const baseMemory: JarvisMemoryData = {
  goals: [],
  habits: [],
  interests: [],
  patterns: [],
  keyFacts: [],
  preferences: {},
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('updateMemoryAsync', () => {
  it('calls chatJson with a memory update prompt', async () => {
    const updated: JarvisMemoryData = { ...baseMemory, interests: ['guitar'] }
    mockChatJson.mockResolvedValueOnce(JSON.stringify(updated))

    await updateMemoryAsync(baseMemory, 'I love guitar', 'Great, keep it up!')

    expect(mockChatJson).toHaveBeenCalledOnce()
    const [messages] = mockChatJson.mock.calls[0]
    expect(messages[0].role).toBe('user')
    expect(messages[0].content).toContain('guitar')
  })

  it('saves the updated memory returned by the LLM', async () => {
    const updated: JarvisMemoryData = { ...baseMemory, interests: ['guitar'] }
    mockChatJson.mockResolvedValueOnce(JSON.stringify(updated))

    await updateMemoryAsync(baseMemory, 'I love guitar', 'Great!')

    expect(mockSetMemory).toHaveBeenCalledWith(updated)
  })

  it('does not throw if chatJson fails — just logs', async () => {
    mockChatJson.mockRejectedValueOnce(new Error('LLM down'))

    await expect(
      updateMemoryAsync(baseMemory, 'test', 'test'),
    ).resolves.toBeUndefined()

    expect(mockSetMemory).not.toHaveBeenCalled()
  })
})
