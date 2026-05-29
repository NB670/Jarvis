import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Notes — Jarvis' }

export default function NotesLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-screen overflow-hidden">{children}</div>
}
