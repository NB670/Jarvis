import { describe, it, expect, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  createNote,
  getNote,
  listNotes,
  updateNote,
  deleteNote,
} from '@/lib/db/notes'

beforeEach(async () => {
  await prisma.note.deleteMany()
})

describe('createNote', () => {
  it('extracts title from markdown heading', async () => {
    const note = await createNote('# My Goal\nLearn Spanish by December.')
    expect(note.title).toBe('My Goal')
  })

  it('handles plain text — uses first line as title', async () => {
    const note = await createNote('Learn Spanish by December.')
    expect(note.title).toBe('Learn Spanish by December.')
  })

  it('extracts title from Tiptap HTML heading', async () => {
    const note = await createNote('<h1>My Goal</h1><p>Learn Spanish</p>')
    expect(note.title).toBe('My Goal')
  })

  it('creates an empty note when content is empty', async () => {
    const note = await createNote('')
    expect(note.title).toBe('')
    expect(note.content).toBe('')
  })
})

describe('listNotes', () => {
  it('returns notes sorted by updatedAt descending', async () => {
    const a = await createNote('First note')
    await new Promise((r) => setTimeout(r, 10))
    const b = await createNote('Second note')
    const notes = await listNotes()
    expect(notes[0].id).toBe(b.id)
    expect(notes[1].id).toBe(a.id)
  })
})

describe('updateNote', () => {
  it('updates content and re-derives title', async () => {
    const note = await createNote('Old title\nOld body')
    const updated = await updateNote(note.id, '# New Title\nNew body')
    expect(updated.title).toBe('New Title')
    expect(updated.content).toBe('# New Title\nNew body')
  })
})

describe('deleteNote', () => {
  it('deletes a note by id', async () => {
    const note = await createNote('To delete')
    await deleteNote(note.id)
    const found = await getNote(note.id)
    expect(found).toBeNull()
  })
})
