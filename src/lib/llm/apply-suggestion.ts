import {
  createGoal,
  createReflection,
  createTask,
  updateGoal,
  updateTask,
} from "@/lib/db";
import type { SuggestedUpdate } from "@prisma/client";
import {
  GoalPriority,
  GoalStatus,
  GoalType,
  SuggestedUpdateType,
  TaskEffort,
  TaskStatus,
  TaskUrgency,
} from "@prisma/client";

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function str(v: unknown, field: string): string {
  if (typeof v !== "string" || !v.trim()) throw new Error(`${field} must be a non-empty string`);
  return v;
}

function optStr(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") throw new Error("Expected string");
  return v;
}

function parseGoalType(v: unknown): GoalType {
  if (v === GoalType.long_term || v === GoalType.short_term) return v;
  throw new Error("Invalid goal type");
}

function parseGoalPriority(v: unknown): GoalPriority {
  if (v === GoalPriority.low || v === GoalPriority.medium || v === GoalPriority.high) return v;
  throw new Error("Invalid goal priority");
}

function parseGoalStatus(v: unknown): GoalStatus | undefined {
  if (v === undefined || v === null) return undefined;
  if (
    v === GoalStatus.active ||
    v === GoalStatus.paused ||
    v === GoalStatus.completed ||
    v === GoalStatus.archived
  )
    return v;
  throw new Error("Invalid goal status");
}

function parseTaskStatus(v: unknown): TaskStatus | undefined {
  if (v === undefined || v === null) return undefined;
  if (
    v === TaskStatus.todo ||
    v === TaskStatus.in_progress ||
    v === TaskStatus.blocked ||
    v === TaskStatus.done ||
    v === TaskStatus.archived
  )
    return v;
  throw new Error("Invalid task status");
}

function parseUrgency(v: unknown): TaskUrgency {
  if (v === TaskUrgency.low || v === TaskUrgency.medium || v === TaskUrgency.high) return v;
  throw new Error("Invalid urgency");
}

function parseEffort(v: unknown): TaskEffort {
  if (v === TaskEffort.small || v === TaskEffort.medium || v === TaskEffort.large) return v;
  throw new Error("Invalid effort");
}

function parseDueDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") throw new Error("dueDate must be ISO string or null");
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid dueDate");
  return d;
}

/** Apply a previously approved suggestion. Throws on invalid payload. */
export async function applySuggestedUpdate(row: SuggestedUpdate) {
  const payload = row.payload;
  if (!isRecord(payload)) throw new Error("Invalid payload");

  switch (row.type) {
    case SuggestedUpdateType.create_goal: {
      await createGoal({
        title: str(payload.title, "title"),
        description: optStr(payload.description),
        type: parseGoalType(payload.type),
        priority: parseGoalPriority(payload.priority),
        status: parseGoalStatus(payload.status),
        whyItMatters: optStr(payload.whyItMatters),
      });
      return;
    }
    case SuggestedUpdateType.update_goal: {
      const id = str(payload.id, "id");
      await updateGoal(id, {
        ...(payload.title !== undefined ? { title: str(payload.title, "title") } : {}),
        ...(payload.description !== undefined ? { description: String(payload.description) } : {}),
        ...(payload.type !== undefined ? { type: parseGoalType(payload.type) } : {}),
        ...(payload.priority !== undefined ? { priority: parseGoalPriority(payload.priority) } : {}),
        ...(payload.status !== undefined ? { status: parseGoalStatus(payload.status) } : {}),
        ...(payload.whyItMatters !== undefined
          ? { whyItMatters: String(payload.whyItMatters) }
          : {}),
      });
      return;
    }
    case SuggestedUpdateType.create_task: {
      await createTask({
        title: str(payload.title, "title"),
        description: optStr(payload.description),
        goalId:
          payload.goalId === undefined
            ? undefined
            : payload.goalId === null
              ? null
              : str(payload.goalId, "goalId"),
        status: parseTaskStatus(payload.status),
        urgency: parseUrgency(payload.urgency),
        effort: parseEffort(payload.effort),
        dueDate: parseDueDate(payload.dueDate),
        nextAction:
          payload.nextAction === null || payload.nextAction === undefined
            ? null
            : String(payload.nextAction),
      });
      return;
    }
    case SuggestedUpdateType.update_task: {
      const id = str(payload.id, "id");
      const data: Parameters<typeof updateTask>[1] = {};
      if (payload.title !== undefined) data.title = str(payload.title, "title");
      if (payload.description !== undefined) data.description = String(payload.description);
      if (payload.goalId !== undefined) {
        data.goalId =
          payload.goalId === null ? null : str(payload.goalId, "goalId");
      }
      if (payload.status !== undefined) data.status = parseTaskStatus(payload.status);
      if (payload.urgency !== undefined) data.urgency = parseUrgency(payload.urgency);
      if (payload.effort !== undefined) data.effort = parseEffort(payload.effort);
      if (payload.dueDate !== undefined) data.dueDate = parseDueDate(payload.dueDate);
      if (payload.nextAction !== undefined) {
        data.nextAction = payload.nextAction === null ? null : String(payload.nextAction);
      }
      await updateTask(id, data);
      return;
    }
    case SuggestedUpdateType.create_reflection: {
      await createReflection({
        content: str(payload.content, "content"),
        relatedGoalId:
          payload.relatedGoalId === null || payload.relatedGoalId === undefined
            ? null
            : str(payload.relatedGoalId, "relatedGoalId"),
      });
      return;
    }
    default: {
      const _exhaustive: never = row.type;
      throw new Error(`Unknown suggestion type: ${_exhaustive}`);
    }
  }
}
