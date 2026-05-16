import { completeJsonChat } from "@/lib/llm/client";
import { parseJarvisRecommendJson } from "@/lib/llm/parse";
import { jarvisRecommendPrompt } from "@/lib/llm/prompts";
import { buildJarvisMemoryContext } from "@/lib/memory/build-context";

export async function runJarvisRecommend() {
  const memory = await buildJarvisMemoryContext();
  const systemBody = `${jarvisRecommendPrompt()}

MEMORY_CONTEXT:
${memory.text}`;

  const raw = await completeJsonChat([{ role: "system", content: systemBody }]);
  return parseJarvisRecommendJson(raw);
}
