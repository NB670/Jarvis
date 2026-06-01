import { spawnSync } from 'child_process'

export function runScript(script: string): string {
  const result = spawnSync('osascript', ['-e', script], { encoding: 'utf8' })
  if (result.error || result.status !== 0) return ''
  return (result.stdout ?? '').toString().trim()
}

export function esc(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '')
    .replace(/\n/g, ' ')
    .replace(/\t/g, ' ')
}
