export function parseTaskPrompt(rawInput: string, today: string, currentTime: string): string {
  return `Parse this task description into structured data. Return ONLY valid JSON, no markdown, no explanation.

Today is ${today}. Current time is ${currentTime}.

Input: "${rawInput}"

Return exactly: { "title": string, "startAt": string | null, "durationMinutes": number }

Rules:
- title: short, clean task name (e.g. "Gym", "Call dentist", "Deep work block")
- startAt: 24-hour "HH:MM" format, or null if no specific time is mentioned
- durationMinutes: integer minutes (default 30 if unclear; "1hr" = 60, "2 hours" = 120, "30 min" = 30)
- Resolve relative times: "morning" = "09:00", "after lunch" = "13:00", "afternoon" = "14:00", "evening" = "18:00", "tonight" = "19:00"
- Ignore filler words like "maybe", "try to", "should"

Examples:
  "gym 9am 1hr"        → { "title": "Gym", "startAt": "09:00", "durationMinutes": 60 }
  "call dentist"       → { "title": "Call dentist", "startAt": null, "durationMinutes": 30 }
  "deep work 2-4pm"    → { "title": "Deep work", "startAt": "14:00", "durationMinutes": 120 }
  "lunch with team"    → { "title": "Lunch with team", "startAt": "12:00", "durationMinutes": 60 }`
}
