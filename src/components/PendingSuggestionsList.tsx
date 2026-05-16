import type { SuggestedUpdate } from "@prisma/client";
import { actionApproveSuggestion, actionRejectSuggestion } from "@/lib/actions";

function PayloadPreview({ payload }: { payload: unknown }) {
  const s = JSON.stringify(payload, null, 2);
  return (
    <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
      {s}
    </pre>
  );
}

export function PendingSuggestionsList({ items }: { items: SuggestedUpdate[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">No pending suggestions.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((s) => (
        <li
          key={s.id}
          className="rounded-lg border border-amber-200/80 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200">
                {s.type.replace(/_/g, " ")}
              </p>
              <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">{s.reason}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <form action={actionApproveSuggestion.bind(null, s.id)}>
                <button
                  type="submit"
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                >
                  Approve
                </button>
              </form>
              <form action={actionRejectSuggestion.bind(null, s.id)}>
                <button
                  type="submit"
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Reject
                </button>
              </form>
            </div>
          </div>
          <PayloadPreview payload={s.payload} />
        </li>
      ))}
    </ul>
  );
}
