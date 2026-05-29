import { getMemory, setMemory } from '@/lib/db'
import type { JarvisMemoryData } from '@/lib/llm/types'
import { NextResponse } from 'next/server'

export async function GET() {
  const memory = await getMemory()
  return NextResponse.json(memory)
}

export async function PUT(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  // Validate runtime shape
  if (
    !body ||
    typeof body !== 'object' ||
    !Array.isArray((body as Record<string, unknown>).goals) ||
    !Array.isArray((body as Record<string, unknown>).habits) ||
    !Array.isArray((body as Record<string, unknown>).interests) ||
    !Array.isArray((body as Record<string, unknown>).patterns) ||
    !Array.isArray((body as Record<string, unknown>).keyFacts) ||
    typeof (body as Record<string, unknown>).preferences !== 'object' ||
    (body as Record<string, unknown>).preferences === null ||
    Array.isArray((body as Record<string, unknown>).preferences)
  ) {
    return NextResponse.json({ error: 'invalid memory shape' }, { status: 400 })
  }

  await setMemory(body as JarvisMemoryData)
  return NextResponse.json({ ok: true })
}
