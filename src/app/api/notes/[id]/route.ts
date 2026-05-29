import { deleteNote, getNote, softDeleteNote, updateNote } from '@/lib/db'
import { updateMemoryFromNote } from '@/lib/jarvis/memory-service'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const note = await getNote(id)
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(note)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json()) as { content?: string }
  if (typeof body.content !== 'string') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }
  try {
    const note = await updateNote(id, body.content)
    // Fire-and-forget: extract memory items from note content
    updateMemoryFromNote(note.title, note.content).catch(() => {})
    return NextResponse.json(note)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const permanent = searchParams.get('permanent') === 'true'
  try {
    if (permanent) {
      await deleteNote(id)
    } else {
      await softDeleteNote(id)
    }
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
