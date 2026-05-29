import { listDeletedNotes, listNotes } from '@/lib/db'
import { NotesClient } from '@/components/notes/NotesClient'

export default async function NotesPage() {
  const [initialNotes, initialDeletedNotes] = await Promise.all([listNotes(), listDeletedNotes()])
  return <NotesClient initialNotes={initialNotes} initialDeletedNotes={initialDeletedNotes} />
}
