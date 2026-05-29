import { prisma } from '@/lib/prisma'
import { EMPTY_MEMORY, type JarvisMemoryData } from '@/lib/llm/types'

export async function getMemory(): Promise<JarvisMemoryData> {
  const row = await prisma.jarvisMemory.findUnique({ where: { id: 'default' } })
  if (!row) return JSON.parse(JSON.stringify(EMPTY_MEMORY))
  return row.data as unknown as JarvisMemoryData
}

export async function setMemory(data: JarvisMemoryData): Promise<void> {
  await prisma.jarvisMemory.upsert({
    where: { id: 'default' },
    create: { id: 'default', data: data as object },
    update: { data: data as object },
  })
}
