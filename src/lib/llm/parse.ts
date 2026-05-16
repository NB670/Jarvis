import type { JarvisChatJson, JarvisRecommendJson } from "@/lib/llm/types";

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/im);
  if (fence?.[1]) return fence[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

export function parseJarvisChatJson(raw: string): JarvisChatJson {
  const json = extractJsonObject(raw);
  const data = JSON.parse(json) as JarvisChatJson;
  if (typeof data.message !== "string") throw new Error("Invalid response: message");
  if (!Array.isArray(data.suggested_updates)) data.suggested_updates = [];
  return data;
}

export function parseJarvisRecommendJson(raw: string): JarvisRecommendJson {
  const json = extractJsonObject(raw);
  const data = JSON.parse(json) as JarvisRecommendJson;
  for (const k of ["recommended_focus", "why_it_matters", "next_smallest_action", "low_energy_fallback"] as const) {
    if (typeof data[k] !== "string") throw new Error(`Invalid recommendation: ${k}`);
  }
  return data;
}
