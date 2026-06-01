import { runJarvisChat } from "@/lib/jarvis/chat-service";
import { LlmError } from "@/lib/llm/client";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { message?: string; images?: string[]; conversationId?: string };
    const text = typeof body.message === "string" ? body.message.trim() : "";
    const images = Array.isArray(body.images) ? (body.images as string[]) : [];
    const conversationId = typeof body.conversationId === "string" ? body.conversationId : undefined;
    if (!text) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }
    const result = await runJarvisChat(text, images, conversationId);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof LlmError) {
      return NextResponse.json(
        { error: e.message },
        { status: e.status && e.status >= 400 && e.status < 600 ? e.status : 502 },
      );
    }
    console.error(e);
    return NextResponse.json({ error: "Chat failed" }, { status: 500 });
  }
}
