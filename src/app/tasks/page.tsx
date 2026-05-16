import { AppNav } from "@/components/AppNav";
import { Muted, SectionCard } from "@/components/SectionCard";
import { actionCreateTask, actionDeleteTask, actionUpdateTask } from "@/lib/actions";
import { listGoals, listTasks } from "@/lib/db";
import { TaskEffort, TaskStatus, TaskUrgency } from "@prisma/client";
import Link from "next/link";

const statusOpts = [
  { v: TaskStatus.todo, l: "Todo" },
  { v: TaskStatus.in_progress, l: "In progress" },
  { v: TaskStatus.blocked, l: "Blocked" },
  { v: TaskStatus.done, l: "Done" },
  { v: TaskStatus.archived, l: "Archived" },
];
const urgOpts = [
  { v: TaskUrgency.low, l: "Low" },
  { v: TaskUrgency.medium, l: "Medium" },
  { v: TaskUrgency.high, l: "High" },
];
const effortOpts = [
  { v: TaskEffort.small, l: "Small" },
  { v: TaskEffort.medium, l: "Medium" },
  { v: TaskEffort.large, l: "Large" },
];

function toDateInput(d: Date | null) {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export default async function TasksPage() {
  const [tasks, goals] = await Promise.all([listTasks(), listGoals()]);

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Tasks</h1>
            <Muted>Link tasks to goals, set urgency, effort, and due dates.</Muted>
          </div>
          <Link href="/" className="text-sm text-zinc-600 underline dark:text-zinc-400">
            ← Dashboard
          </Link>
        </div>

        <SectionCard title="New task">
          <form action={actionCreateTask} className="grid gap-3 md:grid-cols-2">
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
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Goal (optional)</label>
              <select
                name="goalId"
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
            <div>
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Status</label>
              <select
                name="status"
                defaultValue={TaskStatus.todo}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                {statusOpts.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Urgency</label>
              <select
                name="urgency"
                defaultValue={TaskUrgency.medium}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                {urgOpts.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Effort</label>
              <select
                name="effort"
                defaultValue={TaskEffort.medium}
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                {effortOpts.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Due date</label>
              <input
                type="date"
                name="dueDate"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Next action</label>
              <input
                name="nextAction"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                Create task
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard title={`All tasks (${tasks.length})`}>
          {tasks.length === 0 ? (
            <Muted>No tasks yet.</Muted>
          ) : (
            <ul className="space-y-6">
              {tasks.map((t) => (
                <li key={t.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">{t.title}</p>
                      <p className="text-xs text-zinc-500">
                        {t.status} · {t.urgency} · {t.effort}
                        {t.goal ? ` · ${t.goal.title}` : ""}
                      </p>
                    </div>
                    <form action={actionDeleteTask.bind(null, t.id)}>
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
                    <form action={actionUpdateTask.bind(null, t.id)} className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label className="text-xs font-medium text-zinc-500">Title</label>
                        <input
                          name="title"
                          required
                          defaultValue={t.title}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-medium text-zinc-500">Description</label>
                        <textarea
                          name="description"
                          rows={2}
                          defaultValue={t.description}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-zinc-500">Goal</label>
                        <select
                          name="goalId"
                          defaultValue={t.goalId ?? ""}
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
                      <div>
                        <label className="text-xs font-medium text-zinc-500">Status</label>
                        <select
                          name="status"
                          defaultValue={t.status}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                        >
                          {statusOpts.map((o) => (
                            <option key={o.v} value={o.v}>
                              {o.l}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-zinc-500">Urgency</label>
                        <select
                          name="urgency"
                          defaultValue={t.urgency}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                        >
                          {urgOpts.map((o) => (
                            <option key={o.v} value={o.v}>
                              {o.l}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-zinc-500">Effort</label>
                        <select
                          name="effort"
                          defaultValue={t.effort}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                        >
                          {effortOpts.map((o) => (
                            <option key={o.v} value={o.v}>
                              {o.l}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-zinc-500">Due date</label>
                        <input
                          type="date"
                          name="dueDate"
                          defaultValue={toDateInput(t.dueDate)}
                          className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-medium text-zinc-500">Next action</label>
                        <input
                          name="nextAction"
                          defaultValue={t.nextAction ?? ""}
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
