import { listNotes } from '@/lib/db'
import { NotesClient } from '@/components/notes/NotesClient'

export default async function NotesPage() {
  const initialNotes = await listNotes()
  return <NotesClient initialNotes={initialNotes} />
}
