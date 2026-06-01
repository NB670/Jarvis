import { tasksTool } from './tasks'
import { remindersTool } from './reminders'
import type { JarvisTool } from './types'

// ── Registry ──────────────────────────────────────────────────────────────────
// To add a new Jarvis tool:
//   1. Create src/lib/jarvis/tools/my-feature.ts exporting a JarvisTool
//   2. Import it here and add to the array below

export const jarvisTools: JarvisTool[] = [
  tasksTool,
  remindersTool,
]

export async function handleJarvisToolCall(name: string, args: unknown): Promise<string> {
  const tool = jarvisTools.find((t) => t.name === name)
  if (!tool) return `Unknown tool: ${name}`
  return tool.handle(args)
}

export type { JarvisTool }
