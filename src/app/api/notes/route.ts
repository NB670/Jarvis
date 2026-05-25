import { createNote, listNotes } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const notes = await listNotes()
  return NextResponse.json(notes)
}

export async function POST(req: Request) {
  const body = (await req.json()) as { content?: string }
  const content = typeof body.content === 'string' ? body.content : ''
  const note = await createNote(content)
  return NextResponse.json(note, { status: 201 })
}
