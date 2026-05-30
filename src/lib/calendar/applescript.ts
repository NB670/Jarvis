import { spawnSync } from 'child_process'

function runScript(script: string): string {
  const result = spawnSync('osascript', ['-e', script], { encoding: 'utf8' })
  if (result.error || result.status !== 0) return ''
  return (result.stdout ?? '').toString().trim()
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export function createCalendarEvent(
  title: string,
  date: string,       // "YYYY-MM-DD"
  startAt: string | null,   // "HH:MM" 24h, or null for all-day
  durationMinutes: number,
): string | null {
  try {
    const [year, month, day] = date.split('-').map(Number)
    let script: string

    if (startAt) {
      const [hours, minutes] = startAt.split(':').map(Number)
      const timeSeconds = hours * 3600 + minutes * 60
      const endSeconds = timeSeconds + durationMinutes * 60
      script = `
tell application "Calendar"
  tell calendar "Jarvis"
    set startDate to current date
    set year of startDate to ${year}
    set month of startDate to ${month}
    set day of startDate to ${day}
    set time of startDate to ${timeSeconds}
    set endDate to current date
    set year of endDate to ${year}
    set month of endDate to ${month}
    set day of endDate to ${day}
    set time of endDate to ${endSeconds}
    set newEvent to make new event with properties {summary:"${esc(title)}", start date:startDate, end date:endDate}
    return uid of newEvent
  end tell
end tell`
    } else {
      script = `
tell application "Calendar"
  tell calendar "Jarvis"
    set startDate to current date
    set year of startDate to ${year}
    set month of startDate to ${month}
    set day of startDate to ${day}
    set time of startDate to 0
    set endDate to startDate + (${durationMinutes} * 60)
    set newEvent to make new event with properties {summary:"${esc(title)}", start date:startDate, end date:endDate, allday event:true}
    return uid of newEvent
  end tell
end tell`
    }

    const uid = runScript(script)
    return uid || null
  } catch {
    return null
  }
}

export function deleteCalendarEvent(uid: string): void {
  try {
    const script = `
tell application "Calendar"
  repeat with cal in calendars
    set evList to (every event of cal whose uid is "${esc(uid)}")
    repeat with ev in evList
      delete ev
    end repeat
  end repeat
end tell`
    runScript(script)
  } catch {
    // silently ignore — event may already be deleted
  }
}
