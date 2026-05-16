import { listGoals, listReflections, listTasks, getPrimaryFocus } from "@/lib/db";
import { GoalStatus, TaskStatus } from "@prisma/client";

/**
 * Structured snapshot for LLM prompts. Keeps token usage bounded and avoids
 * dumping full history (chat uses recent messages separately).
 */
export async function buildJarvisMemoryContext() {
  const [goals, tasks, reflections, primaryFocus] = await Promise.all([
    listGoals({ status: GoalStatus.active }),
    listTasks({
      status: [TaskStatus.todo, TaskStatus.in_progress, TaskStatus.blocked],
    }),
    listReflections(12),
    getPrimaryFocus(),
  ]);

  const goalsBlock = goals
    .map(
      (g) =>
        `- [${g.type}/${g.priority}/${g.status}] ${g.title} (id: ${g.id})\n  ${g.description || "(no description)"}\n  Why: ${g.whyItMatters || "—"}`,
    )
    .join("\n");

  const tasksBlock = tasks
    .map(
      (t) =>
        `- [${t.status}/${t.urgency}/${t.effort}] ${t.title} (id: ${t.id}, goalId: ${t.goalId ?? "none"})\n  ${t.description || ""}\n  Next: ${t.nextAction ?? "—"} | Due: ${t.dueDate ? t.dueDate.toISOString().slice(0, 10) : "none"}`,
    )
    .join("\n");

  const reflectionsBlock = reflections
    .map((r) => `- (${r.id}${r.relatedGoalId ? `, goal ${r.relatedGoalId}` : ""}) ${r.content}`)
    .join("\n");

  const text = [
    `PRIMARY_FOCUS (dashboard): ${primaryFocus ?? "not set"}`,
    "",
    "ACTIVE_GOALS:",
    goalsBlock || "(none)",
    "",
    "OPEN_TASKS (todo, in_progress, blocked):",
    tasksBlock || "(none)",
    "",
    "RECENT_REFLECTIONS (newest first):",
    reflectionsBlock || "(none)",
  ].join("\n");

  return {
    primaryFocus,
    goals,
    tasks,
    reflections,
    text,
  };
}