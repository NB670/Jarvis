import { AppNav } from "@/components/AppNav";
import { PendingSuggestionsList } from "@/components/PendingSuggestionsList";
import { SectionCard, Muted } from "@/components/SectionCard";
import { WhatNextPanel } from "@/components/WhatNextPanel";
import { actionSetPrimaryFocus } from "@/lib/actions";
import { getDashboardSnapshot } from "@/lib/db";
import Link from "next/link";

function taskLine(t: Awaited<ReturnType<typeof getDashboardSnapshot>>["tasksToday"][number]) {
  return (
    <li key={t.id} className="text-sm text-zinc-800 dark:text-zinc-200">
      <span className="font-medium">{t.title}</span>
      <span className="text-zinc-500 dark:text-zinc-400">
        {" "}
        · {t.status} · {t.urgency} · {t.effort}
      </span>
      {t.goal ? (
        <span className="block text-xs text-zinc-500 dark:text-zinc-500">Goal: {t.goal.title}</span>
      ) : null}
    </li>
  );
}

export default async function DashboardPage() {
  const snap = await getDashboardSnapshot();

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Dashboard
          </h1>
          <Muted>Planning snapshot — Jarvis never writes goals or tasks without your approval.</Muted>
        </div>

        <WhatNextPanel />

        <SectionCard title="Current primary focus">
          <form action={actionSetPrimaryFocus} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400" htmlFor="primaryFocus">
                Focus label
              </label>
              <input
                id="primaryFocus"
                name="primaryFocus"
                defaultValue={snap.primaryFocus ?? ""}
                placeholder="e.g. Ship Jarvis MVP"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-zinc-500"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Save
            </button>
          </form>
        </SectionCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title="Active long-term goals"
            action={
              <Link href="/goals" className="text-xs text-zinc-600 underline dark:text-zinc-400">
                Manage
              </Link>
            }
          >
            {snap.longTermGoals.length === 0 ? (
              <Muted>None — add one on Goals.</Muted>
            ) : (
              <ul className="space-y-2">
                {snap.longTermGoals.map((g) => (
                  <li key={g.id} className="text-sm">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{g.title}</span>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{g.whyItMatters}</p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Active short-term goals"
            action={
              <Link href="/goals" className="text-xs text-zinc-600 underline dark:text-zinc-400">
                Manage
              </Link>
            }
          >
            {snap.shortTermGoals.length === 0 ? (
              <Muted>None — add one on Goals.</Muted>
            ) : (
              <ul className="space-y-2">
                {snap.shortTermGoals.map((g) => (
                  <li key={g.id} className="text-sm">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{g.title}</span>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{g.whyItMatters}</p>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <SectionCard
          title="Tasks"
          action={
            <Link href="/tasks" className="text-xs text-zinc-600 underline dark:text-zinc-400">
              Manage tasks
            </Link>
          }
        >
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <h3 className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Today</h3>
              <ul className="mt-2 space-y-2">
                {snap.tasksToday.length === 0 ? <Muted>No due dates today.</Muted> : snap.tasksToday.map(taskLine)}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">This week</h3>
              <ul className="mt-2 space-y-2">
                {snap.tasksThisWeek.length === 0 ? (
                  <Muted>None scheduled.</Muted>
                ) : (
                  snap.tasksThisWeek.map(taskLine)
                )}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">Backlog</h3>
              <ul className="mt-2 space-y-2">
                {snap.tasksBacklog.length === 0 ? <Muted>No unscheduled open tasks.</Muted> : snap.tasksBacklog.map(taskLine)}
              </ul>
            </div>
          </div>
        </SectionCard>

        <SectionCard title={`Blocked tasks (${snap.blockedTasks.length})`}>
          {snap.blockedTasks.length === 0 ? (
            <Muted>Nothing blocked.</Muted>
          ) : (
            <ul className="space-y-2">
              {snap.blockedTasks.map((t) => (
                <li key={t.id} className="text-sm text-zinc-800 dark:text-zinc-200">
                  <span className="font-medium">{t.title}</span>
                  {t.nextAction ? (
                    <span className="block text-xs text-zinc-500">Next: {t.nextAction}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Recent reflections"
          action={
            <Link href="/reflections" className="text-xs text-zinc-600 underline dark:text-zinc-400">
              All
            </Link>
          }
        >
          {snap.recentReflections.length === 0 ? (
            <Muted>No reflections yet.</Muted>
          ) : (
            <ul className="space-y-3">
              {snap.recentReflections.map((r) => (
                <li key={r.id} className="text-sm text-zinc-800 dark:text-zinc-200">
                  <p>{r.content}</p>
                  {r.relatedGoal ? (
                    <p className="text-xs text-zinc-500">↳ {r.relatedGoal.title}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={`Suggested updates pending (${snap.pendingSuggestions.length})`}>
          <PendingSuggestionsList items={snap.pendingSuggestions} />
        </SectionCard>
      </main>
    </>
  );
}
