export class LlmError extends Error {
  constructor(message: string, public status?: number) {
    super(message)
    this.name = 'LlmError'
  }
}

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_call_id?: string
  tool_calls?: ToolCall[]
}

interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

const WEB_SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Search the web for current information.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
}

async function tavilySearch(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) return '(web search unavailable — TAVILY_API_KEY not set)'

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query, max_results: 5, search_depth: 'basic' }),
  })

  if (!res.ok) return `(search failed: ${res.status})`

  const body = (await res.json()) as {
    results?: Array<{ title: string; url: string; content: string }>
  }

  return (body.results ?? [])
    .slice(0, 5)
    .map((r) => `**${r.title}**\n${r.content}\nSource: ${r.url}`)
    .join('\n\n---\n\n')
}

interface ChatOptions {
  extraTools?: object[]
  onExtraToolCall?: (name: string, args: unknown) => Promise<string>
}

export async function chat(messages: Message[], options: ChatOptions = {}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new LlmError('OPENAI_API_KEY is not set', 503)

  const base = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o'

  const allTools = [WEB_SEARCH_TOOL, ...(options.extraTools ?? [])]

  const callLlm = async (msgs: Message[]) => {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, temperature: 0.6, messages: msgs, tools: allTools }),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new LlmError(`LLM request failed (${res.status}): ${err.slice(0, 800) || res.statusText}`, res.status)
    }

    return res.json() as Promise<{
      choices: Array<{
        message: {
          role: string
          content: string | null
          tool_calls?: ToolCall[]
        }
        finish_reason: string
      }>
    }>
  }

  let body = await callLlm(messages)
  let currentMessages = messages

  while (body.choices[0]?.finish_reason === 'tool_calls' && body.choices[0].message.tool_calls?.length) {
    const choice = body.choices[0]
    const tc = choice.message.tool_calls![0]
    const toolName = tc.function.name
    const toolArgs = JSON.parse(tc.function.arguments) as unknown

    let toolResult: string
    if (toolName === 'web_search') {
      const args = toolArgs as { query: string }
      toolResult = await tavilySearch(args.query)
    } else if (options.onExtraToolCall) {
      toolResult = await options.onExtraToolCall(toolName, toolArgs)
    } else {
      toolResult = `Unknown tool: ${toolName}`
    }

    currentMessages = [
      ...currentMessages,
      { role: 'assistant', content: choice.message.content ?? '', tool_calls: choice.message.tool_calls },
      { role: 'tool', content: toolResult, tool_call_id: tc.id },
    ]

    body = await callLlm(currentMessages)
  }

  const text = body.choices[0]?.message?.content
  if (!text || typeof text !== 'string') throw new LlmError('Empty LLM response', 502)
  return text
}

export async function chatJson(messages: Message[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new LlmError('OPENAI_API_KEY is not set', 503)

  const base = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o'

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages,
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new LlmError(`LLM request failed (${res.status}): ${err.slice(0, 800) || res.statusText}`, res.status)
  }

  const body = (await res.json()) as { choices: Array<{ message: { content?: string | null } }> }
  const text = body.choices?.[0]?.message?.content
  if (!text || typeof text !== 'string') throw new LlmError('Empty LLM response', 502)
  return text
}
