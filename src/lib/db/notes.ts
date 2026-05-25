import { prisma } from '@/lib/prisma'

export function deriveTitle(content: string): string {
  if (content.trimStart().startsWith('<')) {
    // HTML from Tiptap — extract text from first heading or paragraph
    const headingMatch = content.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i)
    if (headingMatch) return headingMatch[1].replace(/<[^>]+>/g, '').trim()
    const pMatch = content.match(/<p[^>]*>(.*?)<\/p>/i)
    if (pMatch) return pMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 80)
    return ''
  }
  // Plain text / markdown
  const firstLine = content.split('\n').find((l) => l.trim() !== '') ?? ''
  return firstLine.replace(/^#+\s*/, '').trim()
}

export async function createNote(content: string) {
  return prisma.note.create({
    data: { content, title: deriveTitle(content) },
  })
}

export async function getNote(id: string) {
  return prisma.note.findUnique({ where: { id } })
}

export async function listNotes() {
  return prisma.note.findMany({ orderBy: { updatedAt: 'desc' } })
}

export async function updateNote(id: string, content: string) {
  return prisma.note.update({
    where: { id },
    data: { content, title: deriveTitle(content) },
  })
}

export async function deleteNote(id: string) {
  return prisma.note.delete({ where: { id } })
}
