import { esc, runScript } from './_utils'

export function createCalendarEvent(
  title: string,
  date: string,
  startAt: string | null,
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
  startAt: string | null
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
    // silently ignore
  }
}
