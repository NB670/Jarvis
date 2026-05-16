import {
  appendChatMessages,
  createSuggestedUpdate,
  getRecentChatMessages,
} from "@/lib/db";
import { completeJsonChat } from "@/lib/llm/client";
import { parseJarvisChatJson } from "@/lib/llm/parse";
import { jarvisSystemPrompt } from "@/lib/llm/prompts";
import type { JarvisSuggestedUpdate } from "@/lib/llm/types";
import { buildJarvisMemoryContext } from "@/lib/memory/build-context";
import { ChatRole, SuggestedUpdateType } from "@prisma/client";

const SUGGESTION_TYPES = new Set<string>(Object.values(SuggestedUpdateType));

function toSuggestionType(t: string): SuggestedUpdateType {
  if (!SUGGESTION_TYPES.has(t)) {
    throw new Error(`Invalid suggested update type: ${t}`);
  }
  return t as SuggestedUpdateType;
}

function normalizeSuggestions(raw: JarvisSuggestedUpdate[]) {
  return raw.map((u) => ({
    type: toSuggestionType(u.type),
    payload: u.payload,
    reason: typeof u.reason === "string" && u.reason.trim() ? u.reason : "No reason provided",
  }));
}

export async function runJarvisChat(userText: string) {
  const memory = await buildJarvisMemoryContext();
  const recent = await getRecentChatMessages(22);

  const systemBody = `${jarvisSystemPrompt()}

MEMORY_CONTEXT:
${memory.text}`;

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemBody },
    ...recent.map((m) => ({
      role: m.role === ChatRole.user ? "user" as const : "assistant" as const,
      content: m.content,
    })),
    { role: "user", content: userText },
  ];

  const raw = await completeJsonChat(messages);
  const parsed = parseJarvisChatJson(raw);

  await appendChatMessages([
    { role: "user", content: userText },
    { role: "assistant", content: parsed.message },
  ]);

  const normalized = normalizeSuggestions(parsed.suggested_updates ?? []);
  const createdIds: string[] = [];
  for (const u of normalized) {
    const row = await createSuggestedUpdate({
      type: u.type,
      payload: u.payload,
      reason: u.reason,
    });
    createdIds.push(row.id);
  }

  return {
    message: parsed.message,
    pendingSuggestionIds: createdIds,
  };
}
