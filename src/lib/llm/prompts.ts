export function jarvisChatSystemPrompt(): string {
  return `You are Jarvis, a personal planning partner and life coach. You know the user deeply through their notes and memory.

Personality: Direct, thoughtful, practical. Never sycophantic. Bias toward the smallest actionable next step. Honest about what you don't know.

Capabilities:
- Hold full planning conversations — strategy, prioritisation, brainstorming
- Answer questions using web_search when current information is needed
- Create and update notes in the user's notes app
- Plan the user's day by scheduling tasks with set_daily_tasks (syncs to Apple Calendar "Jarvis")
- Update what you know about the user (goals, habits, patterns)

When you act on the user's data, describe what you did inline in your response (e.g. "I've added that to your Goals note." or "I've scheduled 4 tasks for today in your calendar.").

You have access to the user's notes, goals, habits, calendar, today's tasks, and memory context — use them.

Output: plain conversational text (you may use markdown bullets when listing things). Do NOT wrap your response in JSON.`
}

export function notesMemoryUpdatePrompt(
  existingMemory: string,
  noteTitle: string,
  noteContent: string,
): string {
  return `You maintain a structured memory about a user for their personal AI assistant, Jarvis.

A note titled "${noteTitle}" was just saved. Extract any goals, habits, interests, key facts, or personal patterns the user revealed by writing it. Merge these into the existing memory.

Rules:
- ONLY add information that is clearly stated in the note (goals listed, habits tracked, facts about the user, etc.)
- Do NOT remove any existing memory items — the note is additive context
- Do NOT add generic observations (e.g. "user takes notes") — only specific, personal items
- If the note contains nothing memory-worthy, return the memory unchanged
- Return ONLY a valid JSON object matching the schema — no markdown, no explanation
- Today's date for timestamps: ${new Date().toISOString().slice(0, 10)}

Memory schema:
{
  "goals": [{ "title": string, "horizon": "long_term"|"short_term", "target"?: string, "lastEngaged"?: string, "priority"?: "low"|"medium"|"high" }],
  "habits": [{ "title": string, "frequency"?: string, "lastMentioned"?: string }],
  "interests": string[],
  "patterns": string[],
  "keyFacts": string[],
  "preferences": Record<string, string>
}

EXISTING MEMORY:
${existingMemory}

NOTE CONTENT (plain text extracted from HTML):
${noteContent}`
}

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

export function jarvisMemoryUpdatePrompt(
  existingMemory: string,
  userMessage: string,
  assistantReply: string,
): string {
  return `You maintain a structured memory about a user for their personal AI assistant, Jarvis.

Given the existing memory JSON and the latest exchange, return an updated memory JSON. Rules:
- Add new goals, habits, interests, facts, or patterns you learned
- Update lastEngaged/lastMentioned timestamps to today's date (${new Date().toISOString().slice(0, 10)}) when the topic came up
- Remove entries that were explicitly cancelled or are clearly outdated
- If nothing meaningful changed, return the memory unchanged
- Return ONLY a valid JSON object matching the schema — no markdown, no explanation

Memory schema:
{
  "goals": [{ "title": string, "horizon": "long_term"|"short_term", "target"?: string, "lastEngaged"?: string, "priority"?: "low"|"medium"|"high" }],
  "habits": [{ "title": string, "frequency"?: string, "lastMentioned"?: string }],
  "interests": string[],
  "patterns": string[],
  "keyFacts": string[],
  "preferences": Record<string, string>
}

EXISTING MEMORY:
${existingMemory}

LATEST EXCHANGE:
User: ${userMessage}
Jarvis: ${assistantReply}`
}
