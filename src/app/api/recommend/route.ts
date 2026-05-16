import { runJarvisRecommend } from "@/lib/jarvis/recommend-service";
import { LlmError } from "@/lib/llm/client";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const result = await runJarvisRecommend();
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof LlmError) {
      return NextResponse.json(
        { error: e.message },
        { status: e.status && e.status >= 400 && e.status < 600 ? e.status : 502 },
      );
    }
    console.error(e);
    return NextResponse.json({ error: "Recommendation failed" }, { status: 500 });
  }
}
