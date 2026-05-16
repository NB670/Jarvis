import { AppNav } from "@/components/AppNav";
import { Muted, SectionCard } from "@/components/SectionCard";
import { actionCreateReflection, actionDeleteReflection, actionUpdateReflection } from "@/lib/actions";
import { listGoals, listReflections } from "@/lib/db";
import Link from "next/link";

export default async function ReflectionsPage() {
  const [reflections, goals] = await Promise.all([listReflections(100), listGoals()]);

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Reflections
            </h1>
            <Muted>Capture durable insights from planning sessions.</Muted>
          </div>
          <Link href="/" className="text-sm text-zinc-600 underline dark:text-zinc-400">
            ← Dashboard
          </Link>
        </div>

        <SectionCard title="New reflection">
          <form action={actionCreateReflection} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Content</label>
              <textarea
                name="content"
                required
                rows={4}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Related goal (optional)</label>
              <select
                name="relatedGoalId"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="">— None —</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Save reflection
            </button>
          </form>
        </SectionCard>

        <SectionCard title={`All reflections (${reflections.length})`}>
          {reflections.length === 0 ? (
            <Muted>No reflections yet.</Muted>
          ) : (
            <ul className="space-y-6">
              {reflections.map((r) => (
                <li key={r.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <p className="text-xs text-zinc-500">
                      {r.createdAt.toLocaleString()}
                      {r.relatedGoal ? ` · ${r.relatedGoal.title}` : ""}
                    </p>
                    <form action={actionDeleteReflection.bind(null, r.id)}>
                      <button
                        type="submit"
                        className="text-xs text-red-600 hover:underline dark:text-red-400"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                  <details className="text-sm">
                    <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">Edit</summary>
                    <form action={actionUpdateReflection.bind(null, r.id)} className="mt-3 space-y-3">
                      <div>
                        <label className="text-xs font-medium text-zinc-500">Content</label>
                        <textarea
                          name="content"
                          required
                          rows={4}
                          defaultValue={r.content}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-zinc-500">Related goal</label>
                        <select
                          name="relatedGoalId"
                          defaultValue={r.relatedGoalId ?? ""}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                        >
                          <option value="">— None —</option>
                          {goals.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="submit"
                        className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
                      >
                        Save changes
                      </button>
                    </form>
                  </details>
                  <p className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">{r.content}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </main>
    </>
  );
}
