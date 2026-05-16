import {
  GoalPriority,
  GoalStatus,
  GoalType,
  PrismaClient,
  TaskEffort,
  TaskStatus,
  TaskUrgency,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.suggestedUpdate.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.reflection.deleteMany();
  await prisma.task.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.appState.deleteMany();

  await prisma.appState.create({
    data: { id: "default", primaryFocus: "Ship Jarvis MVP" },
  });

  const longTerm = await prisma.goal.create({
    data: {
      title: "Build the ultimate personal assistant",
      description: "A voice-first Jarvis that orchestrates life planning, execution, and reflection.",
      type: GoalType.long_term,
      priority: GoalPriority.high,
      status: GoalStatus.active,
      whyItMatters: "Compound clarity and execution over years—not just task lists.",
    },
  });

  const shortTerm = await prisma.goal.create({
    data: {
      title: "Build Jarvis MVP",
      description: "Web dashboard, structured memory, chat, and approval-based updates.",
      type: GoalType.short_term,
      priority: GoalPriority.high,
      status: GoalStatus.active,
      whyItMatters: "Prove the planning loop before investing in voice and integrations.",
    },
  });

  await prisma.task.createMany({
    data: [
      {
        title: "Create dashboard UI",
        description: "Cards for focus, goals, tasks, reflections, pending suggestions.",
        goalId: shortTerm.id,
        status: TaskStatus.in_progress,
        urgency: TaskUrgency.high,
        effort: TaskEffort.medium,
        nextAction: "Wire dashboard to live Prisma queries",
      },
      {
        title: "Implement goals/tasks database",
        description: "Prisma models, migrations, seed, CRUD helpers.",
        goalId: shortTerm.id,
        status: TaskStatus.todo,
        urgency: TaskUrgency.high,
        effort: TaskEffort.medium,
        nextAction: "Run migrate and verify CRUD forms",
      },
      {
        title: "Build chat testing interface",
        description: "Chat page, context builder, LLM integration, suggestion records.",
        goalId: shortTerm.id,
        status: TaskStatus.todo,
        urgency: TaskUrgency.medium,
        effort: TaskEffort.large,
        nextAction: "Implement /api/chat with structured JSON follow-up",
      },
    ],
  });

  await prisma.reflection.create({
    data: {
      content:
        "The final product should be voice-first, but chat is useful for testing.",
      relatedGoalId: longTerm.id,
    },
  });

  console.log("Seed complete.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
