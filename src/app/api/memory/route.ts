import { getMemory, setMemory } from '@/lib/db'
import type { JarvisMemoryData } from '@/lib/llm/types'
import { NextResponse } from 'next/server'

export async function GET() {
  const memory = await getMemory()
  return NextResponse.json(memory)
}

export async function PUT(req: Request) {
  const body = (await req.json()) as JarvisMemoryData
  await setMemory(body)
  return NextResponse.json({ ok: true })
}
