import { deleteNote, getNote, updateNote } from '@/lib/db'
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
    return NextResponse.json(note)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await deleteNote(id)
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
