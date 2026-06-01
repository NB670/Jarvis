import { deleteConversation, getConversationMessages } from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const messages = await getConversationMessages(id)
  return NextResponse.json(messages)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await deleteConversation(id)
  return new NextResponse(null, { status: 204 })
}
