import { esc, runScript } from './_utils'

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
  if not (exists list "Jarvis") then
    make new list with properties {name:"Jarvis"}
  end if
  tell list "Jarvis"
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

export function completeReminder(reminderId: string): void {
  try {
    const script = `
tell application "Reminders"
  if exists list "Jarvis" then
    tell list "Jarvis"
      set matchingReminders to (every reminder whose id is "${esc(reminderId)}")
      repeat with r in matchingReminders
        set completed of r to true
      end repeat
    end tell
  end if
end tell`
    runScript(script)
  } catch {
    // silently ignore
  }
}

export function deleteReminder(reminderId: string): void {
  try {
    const script = `
tell application "Reminders"
  if exists list "Jarvis" then
    tell list "Jarvis"
      set matchingReminders to (every reminder whose id is "${esc(reminderId)}")
      repeat with r in matchingReminders
        delete r
      end repeat
    end tell
  end if
end tell`
    runScript(script)
  } catch {
    // silently ignore
  }
}
