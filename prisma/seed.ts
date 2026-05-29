import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  await prisma.chatMessage.deleteMany()
  await prisma.note.deleteMany()
  await prisma.jarvisMemory.deleteMany()

  await prisma.note.createMany({
    data: [
      {
        title: "Welcome to Jarvis",
        content: "This is your personal notes and planning assistant.",
      },
      {
        title: "Goals for Jarvis MVP",
        content:
          "Build the Notes PWA and Jarvis chat PWA. Keep the stack simple: Next.js, Prisma, SQLite.",
      },
    ],
  })

  await prisma.jarvisMemory.create({
    data: {
      id: "default",
      data: {
        name: "Neel",
        preferences: [],
        goals: [],
        facts: [],
      },
    },
  })

  console.log("Seed complete.")
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
