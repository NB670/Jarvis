import { restoreNote } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const note = await restoreNote(id)
    return NextResponse.json(note)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
