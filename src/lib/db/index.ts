import type { Goal, Prisma, Reflection, SuggestedUpdate as SuggestedUpdateRecord, Task } from "@prisma/client";
import { $Enums, ChatRole, GoalStatus, GoalType, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function listGoals(filters?: {
  type?: GoalType;
  status?: GoalStatus | GoalStatus[];
}) {
  const where: Prisma.GoalWhereInput = {};
  if (filters?.type) where.type = filters.type;
  if (filters?.status) {
    where.status = Array.isArray(filters.status)
      ? { in: filters.status }
      : filters.status;
  }
  return prisma.goal.findMany({
    where,
    orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
  });
}

export async function getGoal(id: string) {
  return prisma.goal.findUnique({ where: { id } });
}

export async function createGoal(data: {
  title: string;
  description?: string;
  type: GoalType;
  priority: Goal["priority"];
  status?: GoalStatus;
  whyItMatters?: string;
}) {
  return prisma.goal.create({
    data: {
      title: data.title,
      description: data.description ?? "",
      type: data.type,
      priority: data.priority,
      status: data.status ?? GoalStatus.active,
      whyItMatters: data.whyItMatters ?? "",
    },
  });
}

export async function updateGoal(
  id: string,
  data: Partial<Pick<Goal, "title" | "description" | "type" | "priority" | "status" | "whyItMatters">>,
) {
  return prisma.goal.update({ where: { id }, data });
}

export async function deleteGoal(id: string) {
  return prisma.goal.delete({ where: { id } });
}

export async function listTasks(filters?: { goalId?: string | null; status?: TaskStatus | TaskStatus[] }) {
  const where: Prisma.TaskWhereInput = {};
  if (filters?.goalId !== undefined) {
    where.goalId = filters.goalId;
  }
  if (filters?.status) {
    where.status = Array.isArray(filters.status)
      ? { in: filters.status }
      : filters.status;
  }
  return prisma.task.findMany({
    where,
    include: { goal: true },
    orderBy: [{ urgency: "desc" }, { dueDate: "asc" }, { updatedAt: "desc" }],
  });
}

export async function getTask(id: string) {
  return prisma.task.findUnique({ where: { id }, include: { goal: true } });
}

export async function createTask(data: {
  title: string;
  description?: string;
  goalId?: string | null;
  status?: TaskStatus;
  urgency: Task["urgency"];
  effort: Task["effort"];
  dueDate?: Date | null;
  nextAction?: string | null;
}) {
  return prisma.task.create({
    data: {
      title: data.title,
      description: data.description ?? "",
      goalId: data.goalId ?? null,
      status: data.status ?? TaskStatus.todo,
      urgency: data.urgency,
      effort: data.effort,
      dueDate: data.dueDate ?? null,
      nextAction: data.nextAction ?? null,
    },
  });
}

export async function updateTask(
  id: string,
  data: Partial<
    Pick<
      Task,
      "title" | "description" | "goalId" | "status" | "urgency" | "effort" | "dueDate" | "nextAction"
    >
  >,
) {
  return prisma.task.update({ where: { id }, data });
}

export async function deleteTask(id: string) {
  return prisma.task.delete({ where: { id } });
}

export async function listReflections(limit = 50) {
  return prisma.reflection.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { relatedGoal: true },
  });
}

export async function createReflection(data: { content: string; relatedGoalId?: string | null }) {
  return prisma.reflection.create({
    data: {
      content: data.content,
      relatedGoalId: data.relatedGoalId ?? null,
    },
  });
}

export async function updateReflection(
  id: string,
  data: Partial<Pick<Reflection, "content" | "relatedGoalId">>,
) {
  return prisma.reflection.update({ where: { id }, data });
}

export async function deleteReflection(id: string) {
  return prisma.reflection.delete({ where: { id } });
}

export async function listPendingSuggestedUpdates() {
  return prisma.suggestedUpdate.findMany({
    where: { status: $Enums.SuggestedUpdateStatus.pending },
    orderBy: { createdAt: "desc" },
  });
}

export async function listSuggestedUpdates(status?: $Enums.SuggestedUpdateStatus) {
  return prisma.suggestedUpdate.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function createSuggestedUpdate(data: {
  type: SuggestedUpdateRecord["type"];
  payload: unknown;
  reason: string;
}) {
  return prisma.suggestedUpdate.create({
    data: {
      type: data.type,
      payload: data.payload as object,
      reason: data.reason,
      status: $Enums.SuggestedUpdateStatus.pending,
    },
  });
}

export async function setSuggestedUpdateStatus(
  id: string,
  status:
    | typeof $Enums.SuggestedUpdateStatus.approved
    | typeof $Enums.SuggestedUpdateStatus.rejected,
) {
  return prisma.suggestedUpdate.update({ where: { id }, data: { status } });
}

export async function approveSuggestion(id: string) {
  return setSuggestedUpdateStatus(id, $Enums.SuggestedUpdateStatus.approved);
}

export async function rejectSuggestion(id: string) {
  return setSuggestedUpdateStatus(id, $Enums.SuggestedUpdateStatus.rejected);
}

export async function getPrimaryFocus() {
  const row = await prisma.appState.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
  return row.primaryFocus;
}

export async function setPrimaryFocus(primaryFocus: string | null) {
  return prisma.appState.upsert({
    where: { id: "default" },
    create: { id: "default", primaryFocus },
    update: { primaryFocus },
  });
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function endOfWeek(d: Date) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  return endOfDay(e);
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Active work tasks (not done/archived) for dashboard groupings */
export async function getActiveWorkTasks() {
  return prisma.task.findMany({
    where: {
      status: { in: [TaskStatus.todo, TaskStatus.in_progress, TaskStatus.blocked] },
    },
    include: { goal: true },
    orderBy: [{ urgency: "desc" }, { dueDate: "asc" }],
  });
}

export async function getDashboardSnapshot() {
  const now = new Date();
  const sow = startOfWeek(now);
  const eow = endOfWeek(now);

  const [
    primaryFocusRow,
    longTermGoals,
    shortTermGoals,
    activeTasks,
    blockedTasks,
    recentReflections,
    pendingSuggestions,
  ] = await Promise.all([
    prisma.appState.findUnique({ where: { id: "default" } }),
    prisma.goal.findMany({
      where: { type: GoalType.long_term, status: GoalStatus.active },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.goal.findMany({
      where: { type: GoalType.short_term, status: GoalStatus.active },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.task.findMany({
      where: {
        status: { in: [TaskStatus.todo, TaskStatus.in_progress, TaskStatus.blocked] },
      },
      include: { goal: true },
      orderBy: [{ urgency: "desc" }, { dueDate: "asc" }],
    }),
    prisma.task.findMany({
      where: { status: TaskStatus.blocked },
      include: { goal: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.reflection.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { relatedGoal: true },
    }),
    prisma.suggestedUpdate.findMany({
      where: { status: $Enums.SuggestedUpdateStatus.pending },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const tasksToday = activeTasks.filter(
    (t) => t.dueDate && sameDay(t.dueDate, now),
  );
  const tasksThisWeek = activeTasks.filter(
    (t) =>
      t.dueDate &&
      !sameDay(t.dueDate, now) &&
      t.dueDate >= sow &&
      t.dueDate <= eow,
  );
  const tasksBacklog = activeTasks.filter((t) => !t.dueDate);

  return {
    primaryFocus: primaryFocusRow?.primaryFocus ?? null,
    longTermGoals,
    shortTermGoals,
    tasksToday,
    tasksThisWeek,
    tasksBacklog,
    blockedTasks,
    recentReflections,
    pendingSuggestions,
  };
}

export async function getRecentChatMessages(limit = 24) {
  return prisma.chatMessage.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
  }).then((rows) => rows.reverse());
}

export async function appendChatMessages(entries: { role: "user" | "assistant"; content: string }[]) {
  await prisma.chatMessage.createMany({
    data: entries.map((e) => ({
      role: e.role === "user" ? ChatRole.user : ChatRole.assistant,
      content: e.content,
    })),
  });
}
