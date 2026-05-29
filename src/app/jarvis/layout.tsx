import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Jarvis' }

export default function JarvisLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-screen overflow-hidden">{children}</div>
}
