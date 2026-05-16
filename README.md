# Jarvis (MVP)

Personal planning assistant: dashboard, goals, tasks, reflections, typed chat with an OpenAI-compatible LLM, and **approval-only** writes from conversations.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4  
- Prisma ORM + SQLite  
- Server Actions for CRUD and suggestion approvals  
- API routes: `POST /api/chat`, `POST /api/recommend`  

## Prerequisites

- Node.js 20+ recommended  
- An API key for any OpenAI-compatible HTTP API (`/v1/chat/completions`)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment**

   ```bash
   cp .env.example .env
   ```

   Edit `.env`:

   - `DATABASE_URL` — default `file:./dev.db` (relative to `prisma/`)
   - `OPENAI_API_KEY` — required for chat and “What should I work on?”
   - `OPENAI_BASE_URL` — optional; default `https://api.openai.com/v1`
   - `OPENAI_MODEL` — optional; default `gpt-4o-mini`

3. **Database**

   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```

4. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Purpose |
|--------|--------|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / start |
| `npm run db:migrate` | Create/apply migrations (`prisma migrate dev`) |
| `npm run db:seed` | Run seed |
| `npm run db:generate` | Regenerate Prisma Client |

## Architecture (modular)

- `src/lib/db/` — Prisma helpers (goals, tasks, reflections, suggestions, dashboard snapshot, chat persistence)  
- `src/lib/memory/build-context.ts` — Builds bounded **MEMORY_CONTEXT** for the LLM  
- `src/lib/llm/` — HTTP client, prompts, JSON parsing, applying approved suggestions  
- `src/lib/jarvis/` — Chat and recommendation orchestration (UI-agnostic; easy to call from voice later)  
- `src/app/api/chat` / `recommend` — Thin HTTP layer with error handling  

Chat uses **recent messages** from SQLite plus **current structured memory**, not the full transcript. Jarvis returns JSON (`message` + `suggested_updates`). Each update is stored as `SuggestedUpdate` with `pending` until you approve it on the dashboard or chat page.

## Seed data

Includes sample long-term/short-term goals, three tasks, one reflection, and primary focus text matching the Jarvis MVP brief.

## Notes

- **No auth** in this MVP — run locally or behind a trusted network.  
- Some OpenAI-compatible servers may not support `response_format: { type: "json_object" }`; if chat fails, try OpenAI or a compatible proxy, or adjust `src/lib/llm/client.ts`.  
- Local SQLite file: `prisma/dev.db` (gitignored).
