"use server";

import {
  approveSuggestion as approveSuggestionDb,
  createGoal,
  createReflection,
  createTask,
  deleteGoal,
  deleteReflection,
  deleteTask,
  rejectSuggestion as rejectSuggestionDb,
  setPrimaryFocus,
  updateGoal,
  updateReflection,
  updateTask,
} from "@/lib/db";
import { applySuggestedUpdate } from "@/lib/llm/apply-suggestion";
import { prisma } from "@/lib/prisma";
import {
  $Enums,
  GoalPriority,
  GoalStatus,
  GoalType,
  TaskEffort,
  TaskStatus,
  TaskUrgency,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function actionCreateGoal(formData: FormData) {
  await createGoal({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    type: formData.get("type") as GoalType,
    priority: formData.get("priority") as GoalPriority,
    status: (formData.get("status") as GoalStatus) ?? GoalStatus.active,
    whyItMatters: String(formData.get("whyItMatters") ?? ""),
  });
  revalidatePath("/");
  revalidatePath("/goals");
}

export async function actionUpdateGoal(id: string, formData: FormData) {
  await updateGoal(id, {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    type: formData.get("type") as GoalType,
    priority: formData.get("priority") as GoalPriority,
    status: formData.get("status") as GoalStatus,
    whyItMatters: String(formData.get("whyItMatters") ?? ""),
  });
  revalidatePath("/");
  revalidatePath("/goals");
}

export async function actionDeleteGoal(id: string) {
  await deleteGoal(id);
  revalidatePath("/");
  revalidatePath("/goals");
}

export async function actionCreateTask(formData: FormData) {
  const due = formData.get("dueDate");
  await createTask({
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    goalId: (() => {
      const g = formData.get("goalId");
      if (!g || String(g) === "") return null;
      return String(g);
    })(),
    status: (formData.get("status") as TaskStatus) ?? TaskStatus.todo,
    urgency: formData.get("urgency") as TaskUrgency,
    effort: formData.get("effort") as TaskEffort,
    dueDate: due && String(due).length > 0 ? new Date(String(due)) : null,
    nextAction: (() => {
      const n = formData.get("nextAction");
      return n && String(n).length > 0 ? String(n) : null;
    })(),
  });
  revalidatePath("/");
  revalidatePath("/tasks");
}

export async function actionUpdateTask(id: string, formData: FormData) {
  const due = formData.get("dueDate");
  await updateTask(id, {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    goalId: (() => {
      const g = formData.get("goalId");
      if (!g || String(g) === "") return null;
      return String(g);
    })(),
    status: formData.get("status") as TaskStatus,
    urgency: formData.get("urgency") as TaskUrgency,
    effort: formData.get("effort") as TaskEffort,
    dueDate: due && String(due).length > 0 ? new Date(String(due)) : null,
    nextAction: (() => {
      const n = formData.get("nextAction");
      return n && String(n).length > 0 ? String(n) : null;
    })(),
  });
  revalidatePath("/");
  revalidatePath("/tasks");
}

export async function actionDeleteTask(id: string) {
  await deleteTask(id);
  revalidatePath("/");
  revalidatePath("/tasks");
}

export async function actionCreateReflection(formData: FormData) {
  await createReflection({
    content: String(formData.get("content") ?? ""),
    relatedGoalId: (() => {
      const g = formData.get("relatedGoalId");
      if (!g || String(g) === "") return null;
      return String(g);
    })(),
  });
  revalidatePath("/");
  revalidatePath("/reflections");
}

export async function actionUpdateReflection(id: string, formData: FormData) {
  await updateReflection(id, {
    content: String(formData.get("content") ?? ""),
    relatedGoalId: (() => {
      const g = formData.get("relatedGoalId");
      if (!g || String(g) === "") return null;
      return String(g);
    })(),
  });
  revalidatePath("/");
  revalidatePath("/reflections");
}

export async function actionDeleteReflection(id: string) {
  await deleteReflection(id);
  revalidatePath("/");
  revalidatePath("/reflections");
}

export async function actionSetPrimaryFocus(formData: FormData) {
  const v = formData.get("primaryFocus");
  const primaryFocus = v && String(v).trim() ? String(v).trim() : null;
  await setPrimaryFocus(primaryFocus);
  revalidatePath("/");
}

export async function actionApproveSuggestion(id: string) {
  const row = await prisma.suggestedUpdate.findUnique({ where: { id } });
  if (!row) throw new Error("Suggestion not found");
  if (row.status !== $Enums.SuggestedUpdateStatus.pending) {
    throw new Error("Suggestion is not pending");
  }
  await applySuggestedUpdate(row);
  await approveSuggestionDb(id);
  revalidatePath("/");
  revalidatePath("/chat");
}

export async function actionRejectSuggestion(id: string) {
  const row = await prisma.suggestedUpdate.findUnique({ where: { id } });
  if (!row) throw new Error("Suggestion not found");
  if (row.status !== $Enums.SuggestedUpdateStatus.pending) {
    throw new Error("Suggestion is not pending");
  }
  await rejectSuggestionDb(id);
  revalidatePath("/");
  revalidatePath("/chat");
}
