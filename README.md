# Kan

Open-source, self-hosted Kanban board. Create boards, organize work into lists, and track tasks with cards.

## Tech Stack

**Monorepo** (Turbo + pnpm)

| Layer | Technology |
|---|---|
| Frontend | TanStack Start, React 18, Vite |
| Backend | Hono on Bun |
| Database | PostgreSQL 15 (PGLite for zero-config dev) |
| ORM | Drizzle |
| Auth | better-auth |
| Styling | Tailwind CSS |
| Deployment | Docker Compose, Cloudflare Workers |

## Features

- Boards with public/private visibility and templates
- Drag-and-drop lists and cards
- Rich text editor (Tiptap) with markdown
- Color-coded labels, checklists, due dates
- Smart filtering by members, labels, lists, dates
- Resource items for saving links, videos, and references
- REST API with auto-generated OpenAPI spec and Scalar docs
- API keys for programmatic access
- S3-compatible file uploads (avatars, attachments)
- Dark mode with system-aware switching
- Redis rate limiting (optional, falls back to in-memory)

## Quick Start

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Runs at `http://localhost:3000`. No database setup needed — falls back to PGLite when `POSTGRES_URL` is not set.

### Docker

```bash
docker compose up
```

Starts the web app, API, and PostgreSQL.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_URL` | No | PostgreSQL connection string (PGLite if omitted) |
| `BETTER_AUTH_SECRET` | Yes | Secret for session signing |
| `BETTER_AUTH_URL` | Yes | Base URL of the app |
| `R2_ACCOUNT_ID` | No | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | No | R2 access key |
| `R2_SECRET_ACCESS_KEY` | No | R2 secret key |
| `R2_BUCKET_NAME` | No | R2 bucket for uploads |

## Project Structure

```
kan/
├── apps/web/              Frontend (TanStack Start + Vite)
│   └── src/
│       ├── app/           File-based routing
│       ├── components/    Reusable UI components
│       ├── views/         Page-specific views (board, card, resources, settings)
│       ├── hooks/         Custom React hooks
│       ├── providers/     Context providers (auth, theme, modals)
│       └── utils/         API client, routing helpers
├── packages/api/          Backend (Hono on Bun)
│   └── src/
│       ├── routes/        API endpoint handlers
│       ├── db/
│       │   ├── schema/    Drizzle schema definitions
│       │   └── repository/ Data access layer
│       ├── lib/           Server utilities
│       └── auth.ts        Auth configuration
├── docker-compose.yml
└── turbo.json
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server (web + API) |
| `pnpm build` | Production build |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:push` | Push schema to database |
| `pnpm db:studio` | Open Drizzle Studio |
