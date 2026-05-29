import { prisma } from '@/lib/prisma'

export function deriveTitle(content: string): string {
  if (content.trimStart().startsWith('<')) {
    const headingMatch = content.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i)
    if (headingMatch) return headingMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 80)
    const pMatch = content.match(/<p[^>]*>(.*?)<\/p>/i)
    if (pMatch) return pMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 80)
    return ''
  }
  const firstLine = content.split('\n').find((l) => l.trim() !== '') ?? ''
  return firstLine.replace(/^#+\s*/, '').trim().slice(0, 80)
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
  return prisma.note.findMany({ where: { deletedAt: null }, orderBy: { updatedAt: 'desc' } })
}

export async function listDeletedNotes() {
  return prisma.note.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: 'desc' },
  })
}

export async function updateNote(id: string, content: string) {
  return prisma.note.update({
    where: { id },
    data: { content, title: deriveTitle(content) },
  })
}

export async function softDeleteNote(id: string) {
  return prisma.note.update({ where: { id }, data: { deletedAt: new Date() } })
}

export async function restoreNote(id: string) {
  return prisma.note.update({ where: { id }, data: { deletedAt: null } })
}

export async function deleteNote(id: string) {
  return prisma.note.delete({ where: { id } })
}
