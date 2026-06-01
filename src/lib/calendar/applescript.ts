import { spawnSync } from 'child_process'

function runScript(script: string): string {
  const result = spawnSync('osascript', ['-e', script], { encoding: 'utf8' })
  if (result.error || result.status !== 0) return ''
  return (result.stdout ?? '').toString().trim()
}

function esc(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '')
    .replace(/\n/g, ' ')
    .replace(/\t/g, ' ')
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

export interface CalendarEventData {
  uid: string
  title: string
  startAt: string | null  // "HH:MM" or null for all-day
  durationMinutes: number
}

export function listCalendarEventsForDate(date: string): CalendarEventData[] {
  try {
    const [year, month, day] = date.split('-').map(Number)
    const script = `
tell application "Calendar"
  tell calendar "Jarvis"
    set startBound to current date
    set year of startBound to ${year}
    set month of startBound to ${month}
    set day of startBound to ${day}
    set time of startBound to 0
    set endBound to startBound + 86400
    set evList to (every event whose start date >= startBound and start date < endBound)
    set output to ""
    repeat with ev in evList
      set evUID to uid of ev
      set evSummary to summary of ev
      set evStart to start date of ev
      set evEnd to end date of ev
      set isAllDay to allday event of ev
      if isAllDay then
        set startHH to -1
        set startMM to -1
      else
        set startHH to hours of evStart
        set startMM to minutes of evStart
      end if
      set durationSecs to (evEnd - evStart) as integer
      set durationMins to (durationSecs div 60)
      set output to output & evUID & "|" & evSummary & "|" & startHH & "|" & startMM & "|" & durationMins & "\\n"
    end repeat
    return output
  end tell
end tell`
    const raw = runScript(script)
    if (!raw) return []
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [uid, title, hhStr, mmStr, durStr] = line.split('|')
        const hh = parseInt(hhStr, 10)
        const mm = parseInt(mmStr, 10)
        const startAt = hh >= 0 ? `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` : null
        return { uid, title, startAt, durationMinutes: Math.max(1, parseInt(durStr, 10)) }
      })
  } catch {
    return []
  }
}

export function createReminder(title: string, dueAt: Date, notes?: string): string | null {
  try {
    const month = dueAt.getMonth() + 1
    const day = dueAt.getDate()
    const year = dueAt.getFullYear()
    const hours = dueAt.getHours()
    const minutes = dueAt.getMinutes()
    const seconds = dueAt.getSeconds()
    const timeSeconds = hours * 3600 + minutes * 60 + seconds
    const notesClause = notes ? `set body of newReminder to "${esc(notes)}"` : ''
    const script = `
tell application "Reminders"
  tell default list
    set newReminder to make new reminder with properties {name:"${esc(title)}"}
    set due date of newReminder to current date
    set year of (due date of newReminder) to ${year}
    set month of (due date of newReminder) to ${month}
    set day of (due date of newReminder) to ${day}
    set time of (due date of newReminder) to ${timeSeconds}
    set remind me date of newReminder to (due date of newReminder)
    ${notesClause}
    return id of newReminder
  end tell
end tell`
    const id = runScript(script)
    return id || null
  } catch {
    return null
  }
}

export function deleteReminder(reminderId: string): void {
  try {
    const script = `
tell application "Reminders"
  set theReminder to reminder id "${esc(reminderId)}"
  if theReminder is not missing value then
    delete theReminder
  end if
end tell`
    runScript(script)
  } catch {
    // silently ignore
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
