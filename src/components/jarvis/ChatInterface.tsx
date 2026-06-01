'use client'

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  role: 'user' | 'assistant'
  content: string
  images?: string[]
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-3 last:mb-0 leading-7">{children}</p>,
        h1: ({ children }) => <h1 className="text-xl font-bold mb-3 mt-4 first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="text-lg font-semibold mb-2 mt-4 first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h3>,
        ul: ({ children }) => <ul className="mb-3 space-y-1 pl-1">{children}</ul>,
        ol: ({ children }) => <ol className="mb-3 space-y-1 pl-1 list-decimal list-inside">{children}</ol>,
        li: ({ children }) => (
          <li className="flex gap-2 text-sm leading-6">
            <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 flex-shrink-0" />
            <span>{children}</span>
          </li>
        ),
        code: ({ className, children, ...props }) => {
          const isBlock = className?.includes('language-')
          if (isBlock) {
            return (
              <div className="my-3 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700">
                <div className="bg-zinc-100 dark:bg-zinc-800 px-4 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-mono border-b border-zinc-200 dark:border-zinc-700">
                  {className?.replace('language-', '') ?? 'code'}
                </div>
                <pre className="bg-zinc-50 dark:bg-zinc-900 px-4 py-3 overflow-x-auto text-xs font-mono leading-6 text-zinc-800 dark:text-zinc-200">
                  <code>{children}</code>
                </pre>
              </div>
            )
          }
          return (
            <code
              className="px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-[0.85em] font-mono"
              {...props}
            >
              {children}
            </code>
          )
        },
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-zinc-300 dark:border-zinc-600 pl-4 my-3 text-zinc-500 dark:text-zinc-400 italic">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-4 border-zinc-200 dark:border-zinc-700" />,
        strong: ({ children }) => <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{children}</strong>,
        a: ({ href, children }) => (
          <a href={href} className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>
        ),
        table: ({ children }) => (
          <div className="my-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
            <table className="w-full text-sm">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="px-4 py-2 text-left font-semibold bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">{children}</th>,
        td: ({ children }) => <td className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  )
}

export function ChatInterface({ initialMessages }: { initialMessages?: Message[] }) {
  const [messages, setMessages] = useState<Message[]>(
    initialMessages?.length
      ? initialMessages
      : [{ role: 'assistant', content: "Hey, I'm Jarvis. What are you working on today?" }],
  )
  const [input, setInput] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const url = ev.target?.result as string
        setImages((prev) => [...prev, url])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const removeImage = (i: number) => setImages((prev) => prev.filter((_, j) => j !== i))

  const send = async () => {
    const text = input.trim()
    if ((!text && images.length === 0) || loading) return
    const sentImages = [...images]
    setInput('')
    setImages([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setMessages((prev) => [...prev, { role: 'user', content: text, images: sentImages }])
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, images: sentImages }),
      })
      const data = (await res.json()) as { message?: string; error?: string }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.message ?? data.error ?? 'Something went wrong.' },
      ])
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Network error. Try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white dark:text-zinc-900 text-xs font-bold">J</span>
                </div>
              )}
              <div className={`flex flex-col gap-2 ${m.role === 'user' ? 'items-end max-w-[80%]' : 'items-start flex-1'}`}>
                {m.images && m.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-end">
                    {m.images.map((src, j) => (
                      <img key={j} src={src} alt="" className="max-h-48 max-w-xs rounded-xl object-cover border border-zinc-200 dark:border-zinc-700" />
                    ))}
                  </div>
                )}
                {m.content && (
                  m.role === 'user' ? (
                    <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 leading-7 whitespace-pre-wrap">
                      {m.content}
                    </div>
                  ) : (
                    <div className="text-sm text-zinc-800 dark:text-zinc-200 leading-7">
                      <MarkdownContent content={m.content} />
                    </div>
                  )
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-full bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white dark:text-zinc-900 text-xs font-bold">J</span>
              </div>
              <div className="pt-1"><ThinkingDots /></div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          {/* Image previews */}
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {images.map((src, i) => (
                <div key={i} className="relative group">
                  <img src={src} alt="" className="h-16 w-16 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 focus-within:ring-1 focus-within:ring-zinc-400 dark:focus-within:ring-zinc-500 transition-shadow">
            {/* Image attach */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-shrink-0 mb-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              title="Attach image"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="1.5" y="3" width="15" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                <circle cx="6" cy="7.5" r="1.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M1.5 12l4-3.5 3 2.5 2.5-2.5 5 4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
              </svg>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImagePick} />

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              rows={1}
              onChange={(e) => { setInput(e.target.value); autoResize() }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
              }}
              placeholder="Ask Jarvis anything…"
              className="flex-1 resize-none bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none leading-6 max-h-40 py-0.5"
            />

            {/* Send */}
            <button
              onClick={send}
              disabled={loading || (!input.trim() && images.length === 0)}
              className="flex-shrink-0 mb-0.5 w-7 h-7 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center disabled:opacity-30 transition-opacity"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 12V2M2 7l5-5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          <p className="text-center text-xs text-zinc-400 dark:text-zinc-600 mt-2">Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  )
}
