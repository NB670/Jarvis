import { createConversation, listConversations } from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const conversations = await listConversations()
  return NextResponse.json(conversations)
}

export async function POST() {
  const conversation = await createConversation()
  return NextResponse.json(conversation)
}
