import { AppNav } from "@/components/AppNav";
import { Muted, SectionCard } from "@/components/SectionCard";
import { actionCreateGoal, actionDeleteGoal, actionUpdateGoal } from "@/lib/actions";
import { listGoals } from "@/lib/db";
import { GoalPriority, GoalStatus, GoalType } from "@prisma/client";
import Link from "next/link";

const goalTypeOpts = [
  { v: GoalType.long_term, l: "Long term" },
  { v: GoalType.short_term, l: "Short term" },
];
const prioOpts = [
  { v: GoalPriority.low, l: "Low" },
  { v: GoalPriority.medium, l: "Medium" },
  { v: GoalPriority.high, l: "High" },
];
const statusOpts = [
  { v: GoalStatus.active, l: "Active" },
  { v: GoalStatus.paused, l: "Paused" },
  { v: GoalStatus.completed, l: "Completed" },
  { v: GoalStatus.archived, l: "Archived" },
];

export default async function GoalsPage() {
  const goals = await listGoals();

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Goals</h1>
            <Muted>Create and edit long-term and short-term goals.</Muted>
          </div>
          <Link href="/" className="text-sm text-zinc-600 underline dark:text-zinc-400">
            ← Dashboard
          </Link>
        </div>

        <SectionCard title="New goal">
          <form action={actionCreateGoal} className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Title</label>
              <input
                name="title"
                required
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Description</label>
              <textarea
                name="description"
                rows={2}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Type</label>
              <select
                name="type"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                defaultValue={GoalType.short_term}
              >
                {goalTypeOpts.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Priority</label>
              <select
                name="priority"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                defaultValue={GoalPriority.medium}
              >
                {prioOpts.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Status</label>
              <select
                name="status"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                defaultValue={GoalStatus.active}
              >
                {statusOpts.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Why it matters</label>
              <textarea
                name="whyItMatters"
                rows={2}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                Create goal
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title={`All goals (${goals.length})`}>
          {goals.length === 0 ? (
            <Muted>No goals yet.</Muted>
          ) : (
            <ul className="space-y-6">
              {goals.map((g) => (
                <li key={g.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">{g.title}</p>
                      <p className="text-xs text-zinc-500">
                        {g.type} · {g.priority} · {g.status}
                      </p>
                    </div>
                    <form action={actionDeleteGoal.bind(null, g.id)}>
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
                    <form action={actionUpdateGoal.bind(null, g.id)} className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label className="text-xs font-medium text-zinc-500">Title</label>
                        <input
                          name="title"
                          required
                          defaultValue={g.title}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-medium text-zinc-500">Description</label>
                        <textarea
                          name="description"
                          rows={2}
                          defaultValue={g.description}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-zinc-500">Type</label>
                        <select
                          name="type"
                          defaultValue={g.type}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                        >
                          {goalTypeOpts.map((o) => (
                            <option key={o.v} value={o.v}>
                              {o.l}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-zinc-500">Priority</label>
                        <select
                          name="priority"
                          defaultValue={g.priority}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                        >
                          {prioOpts.map((o) => (
                            <option key={o.v} value={o.v}>
                              {o.l}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-medium text-zinc-500">Status</label>
                        <select
                          name="status"
                          defaultValue={g.status}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                        >
                          {statusOpts.map((o) => (
                            <option key={o.v} value={o.v}>
                              {o.l}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-medium text-zinc-500">Why it matters</label>
                        <textarea
                          name="whyItMatters"
                          rows={2}
                          defaultValue={g.whyItMatters}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <button
                          type="submit"
                          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
                        >
                          Save changes
                        </button>
                      </div>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </main>
    </>
  );
}
