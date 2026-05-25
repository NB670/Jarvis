import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { getMemory, setMemory } from '@/lib/db/memory'
import type { JarvisMemoryData } from '@/lib/llm/types'

beforeEach(async () => {
  await prisma.jarvisMemory.deleteMany()
})

describe('getMemory', () => {
  it('returns empty memory when no record exists', async () => {
    const mem = await getMemory()
    expect(mem.goals).toEqual([])
    expect(mem.habits).toEqual([])
    expect(mem.interests).toEqual([])
  })
})

describe('setMemory', () => {
  it('creates the memory record if it does not exist', async () => {
    const data: JarvisMemoryData = {
      goals: [{ title: 'Learn Spanish', horizon: 'long_term' }],
      habits: [],
      interests: ['guitar'],
      patterns: [],
      keyFacts: [],
      preferences: {},
    }
    await setMemory(data)
    const mem = await getMemory()
    expect(mem.goals[0].title).toBe('Learn Spanish')
    expect(mem.interests).toContain('guitar')
  })

  it('overwrites existing memory', async () => {
    await setMemory({ goals: [{ title: 'Old', horizon: 'short_term' }], habits: [], interests: [], patterns: [], keyFacts: [], preferences: {} })
    await setMemory({ goals: [{ title: 'New', horizon: 'long_term' }], habits: [], interests: [], patterns: [], keyFacts: [], preferences: {} })
    const mem = await getMemory()
    expect(mem.goals).toHaveLength(1)
    expect(mem.goals[0].title).toBe('New')
  })
})
