---
name: kan-task-manager
description: Manage tasks on a Kan Kanban board via its REST API. Use when the agent needs to create, update, move, or delete cards (tasks) on a board; create or manage lists, labels, and checklists; or query board state. Triggers on any request involving task tracking, project management, or Kanban workflows backed by a running Kan instance.
---

# Kan Task Manager

Manage Kanban boards, lists, cards, labels, and checklists via the Kan REST API.

## Connection

- **Base**: `https://kan.simonbalfe.com/api`
- **Auth**: `Authorization: Bearer kan_sk_e010d8219402cfc8f9215e765dcfc`
- **No trailing slashes** — `/api/boards` not `/api/boards/`

## Hierarchy

```
Board → Lists → Cards → Checklists → Checklist Items
                  ↕
               Labels (many-to-many, scoped to board)
```

## Endpoints

### Boards

| Method | Path | Body / Query | Purpose |
|--------|------|--------------|---------|
| GET | `/boards` | `?type=regular\|template` | List boards |
| GET | `/boards/:id` | `?labels&lists&members&dueDateFilters` | Get board with children |
| GET | `/boards/by-slug/:slug` | same query params | Get board by slug |
| POST | `/boards` | `{ name, lists: [], labels: [], type?, sourceBoardPublicId? }` | Create board |
| PUT | `/boards/:id` | `{ name?, slug?, visibility? }` | Update board |
| DELETE | `/boards/:id` | — | Soft-delete board + children |

### Lists

| Method | Path | Body |
|--------|------|------|
| POST | `/lists` | `{ name, boardPublicId }` |
| PUT | `/lists/:id` | `{ name?, index? }` |
| DELETE | `/lists/:id` | — |

### Cards

| Method | Path | Body |
|--------|------|------|
| POST | `/cards` | `{ title, description, listPublicId, position, labelPublicIds?, dueDate? }` |
| GET | `/cards/:id` | — |
| PUT | `/cards/:id` | `{ title?, description?, index?, listPublicId?, dueDate? }` |
| DELETE | `/cards/:id` | — |
| PUT | `/cards/:id/labels/:labelId` | — (toggle, returns `{ newLabel: boolean }`) |

`position`: `"start"` or `"end"`. `description`: required on create (use `""`). `dueDate`: ISO string or `null`.

### Labels

| Method | Path | Body |
|--------|------|------|
| GET | `/labels/:id` | — |
| POST | `/labels` | `{ name, boardPublicId, colourCode }` |
| PUT | `/labels/:id` | `{ name, colourCode }` |
| DELETE | `/labels/:id` | — |

`colourCode`: hex `#RRGGBB`.

### Checklists

| Method | Path | Body |
|--------|------|------|
| POST | `/checklists` | `{ cardPublicId, name }` |
| PUT | `/checklists/:id` | `{ name }` |
| DELETE | `/checklists/:id` | — |
| POST | `/checklists/:id/items` | `{ title }` |
| PATCH | `/checklists/items/:itemId` | `{ title?, completed?, index? }` |
| DELETE | `/checklists/items/:itemId` | — |

## Common Workflows

### Add a task

1. `GET /boards` → find board publicId
2. `GET /boards/:id` → find target list publicId
3. `POST /cards` with `{ title, description: "", listPublicId, position: "end" }`

### Move a card

```
PUT /cards/:id  →  { listPublicId: "<target>", index: 0 }
```

### Add a checklist

1. `POST /checklists` with `{ cardPublicId, name }`
2. `POST /checklists/:id/items` with `{ title }` for each item
3. `PATCH /checklists/items/:itemId` with `{ completed: true }` to check off

## Field Constraints

| Field | Constraint |
|-------|-----------|
| Board name | 1–100 chars |
| Card title | 1–2000 chars |
| Card description | max 10000 chars |
| Card position | `"start"` or `"end"` |
| Label name | 1–36 chars |
| Label colourCode | hex `#RRGGBB` |
| Checklist name | 1–255 chars |
| Checklist item title | 1–500 chars |
| Due date filters | `overdue`, `today`, `tomorrow`, `next-week`, `next-month`, `no-due-date` |

## Errors

JSON `{ error: string }` with status 400 (validation), 404 (not found), or 500 (server).
