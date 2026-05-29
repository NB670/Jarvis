import { getMemory } from '@/lib/db'
import { JarvisClient } from '@/components/jarvis/JarvisClient'

export default async function JarvisPage() {
  const initialMemory = await getMemory()
  return <JarvisClient initialMemory={initialMemory} />
}
