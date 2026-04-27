# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup       # First-time setup: install deps, generate Prisma client, run migrations
npm run dev         # Dev server with Turbopack on :3000
npm run build       # Production build
npm run start       # Start production server
npm run test        # Run Vitest
npm run lint        # Run ESLint
npm run db:reset    # Reset SQLite database
```

Run a single test file: `npx vitest run <path-to-test>`

**Required env:** `ANTHROPIC_API_KEY` in `.env`. If absent, the app falls back to `MockLanguageModel` with canned component templates.

## Architecture

UIGen is an AI-powered React component generator. Users describe components in a chat interface; Claude generates/edits them via tool calls; a live preview renders the result instantly.

### Request Flow

1. User submits message → `ChatContext` → `POST /api/chat`
2. `/api/chat` streams a Claude response using Vercel AI SDK. Claude has two tools:
   - `str_replace_editor` — view/create/edit file content in the virtual FS
   - `file_manager` — rename/delete files in the virtual FS
3. Tool call results update the in-memory `VirtualFileSystem` instance on the server during streaming
4. Deltas stream back to the client via `useChat` (Vercel AI SDK)
5. `FileSystemContext` receives updates → triggers preview refresh
6. Preview: Babel Standalone transpiles JSX client-side → blob URLs created → ESM import map maps `npm` packages to `esm.sh` CDN → sandboxed `<iframe>` renders the component
7. On completion, if authenticated, the full project state (messages + serialized FS) is saved to SQLite via Prisma

### Key Modules

| Path | Purpose |
|------|---------|
| `src/app/api/chat/route.ts` | Streaming chat endpoint; tool definitions; DB persistence on finish |
| `src/lib/file-system.ts` | In-memory virtual file system — all file state lives here |
| `src/lib/contexts/` | `FileSystemContext` and `ChatContext` — primary state providers |
| `src/lib/transform/` | Client-side JSX→JS via Babel Standalone + import map generation |
| `src/lib/provider.ts` | `getLanguageModel()` — returns Claude or MockLanguageModel |
| `src/lib/prompts/` | System prompt sent to Claude |
| `src/lib/tools/` | AI tool schemas (`str_replace_editor`, `file_manager`) |
| `src/actions/` | Server Actions: auth (sign up/in/out) and project CRUD |
| `src/components/preview/` | `PreviewFrame` — renders blob-URL modules in sandboxed iframe |
| `src/components/editor/` | Monaco-based code editor + file tree |
| `src/components/chat/` | Chat UI (message list, input) |
| `prisma/schema.prisma` | `User` (email + bcrypt password) and `Project` (name, messages, file data) |

### Important Implementation Details

- **Virtual FS is in-memory only.** Files are never written to disk during editing. Persistence happens only through the database (authenticated users).
- **Anonymous mode** works without login. Anonymous usage is tracked via localStorage (`src/lib/anon-work-tracker.ts`).
- **Babel Standalone runs in the browser** to transform JSX at preview time — no build step in the preview pipeline.
- **Prompt caching** is enabled via `providerOptions.anthropic.cacheControl` on the system prompt to reduce latency.
- Path alias `@/*` maps to `src/*`.
