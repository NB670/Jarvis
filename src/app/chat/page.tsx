import { AppNav } from "@/components/AppNav";
import { ChatClient } from "@/components/ChatClient";
import { PendingSuggestionsList } from "@/components/PendingSuggestionsList";
import { SectionCard } from "@/components/SectionCard";
import { getRecentChatMessages, listPendingSuggestedUpdates } from "@/lib/db";
import { ChatRole } from "@prisma/client";
import Link from "next/link";

export default async function ChatPage() {
  const [raw, pending] = await Promise.all([getRecentChatMessages(40), listPendingSuggestedUpdates()]);

  const initialMessages = raw.map((m) => ({
    role: m.role === ChatRole.user ? ("user" as const) : ("assistant" as const),
    content: m.content,
  }));

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Chat</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Test Jarvis with typed messages. Approvals for memory updates live on the dashboard too.
            </p>
          </div>
          <Link href="/" className="text-sm text-zinc-600 underline dark:text-zinc-400">
            ← Dashboard
          </Link>
        </div>

        <ChatClient initialMessages={initialMessages} />

        <SectionCard title={`Pending suggestions (${pending.length})`}>
          <PendingSuggestionsList items={pending} />
        </SectionCard>
      </main>
    </>
  );
}
