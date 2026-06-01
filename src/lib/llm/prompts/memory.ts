const MEMORY_SCHEMA = `{
  "goals": [{ "title": string, "horizon": "long_term"|"short_term", "target"?: string, "lastEngaged"?: string, "priority"?: "low"|"medium"|"high" }],
  "habits": [{ "title": string, "frequency"?: string, "lastMentioned"?: string }],
  "interests": string[],
  "patterns": string[],
  "keyFacts": string[],
  "preferences": Record<string, string>
}`

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
${MEMORY_SCHEMA}

EXISTING MEMORY:
${existingMemory}

NOTE CONTENT (plain text extracted from HTML):
${noteContent}`
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
${MEMORY_SCHEMA}

EXISTING MEMORY:
${existingMemory}

LATEST EXCHANGE:
User: ${userMessage}
Jarvis: ${assistantReply}`
}
