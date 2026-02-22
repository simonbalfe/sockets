---
name: kan-task-manager
description: Manage tasks on a Kan Kanban board via its REST API. Use when the agent needs to create, update, move, or delete cards (tasks) on a board; create or manage lists, labels, and checklists; or query board state. Triggers on any request involving task tracking, project management, or Kanban workflows backed by a running Kan instance.
---

# Kan Task Manager

Kan is a self-hosted Kanban board application backed by a Hono API.

## Base URL

All endpoints are prefixed with `/api`. The url is `https://kan.simonbalfe.com`.

**IMPORTANT**: Do NOT use trailing slashes on any API paths. Use `/api/boards` not `/api/boards/`. Trailing slashes return 404.

## Core Concepts

- **Board**: Top-level container holding lists and labels. Has a `publicId` and a unique `slug`.
- **List**: A column within a board (e.g., "To Do", "In Progress", "Done"). Contains cards ordered by `index`.
- **Card**: A task within a list. Supports descriptions, due dates, labels, and checklists.
- **Label**: A colored tag scoped to a board, applied to cards via toggle.
- **Checklist**: A named checklist attached to a card, containing ordered items with completion state.

All entities use `publicId` (12-char string) as the identifier in API paths.

Soft-delete is used throughout: deleted records keep their data but are excluded from queries.

## Authentication

All protected endpoints require authentication. There are two methods:

### 1. User API Key (recommended for agent/direct use)

Include the key as a Bearer token on every request:

```
Authorization: Bearer kan_<token>
```

Keys never expire. Ask the user to provide their API key, or generate one.

#### Generating a key

A key can only be generated while authenticated via session (browser login). Once generated, store it for future use.

```
POST /api/user-api-keys
```

No body required. Returns:

```json
{ "key": "kan_abc123..." }
```

#### Example request with key

```bash
curl -H "Authorization: Bearer kan_abc123..." https://kan.simonbalfe.com/api/boards
```

### 2. Session Cookie (browser/proxy flow)

Authenticate via better-auth:

```
POST /api/auth/sign-in/email
Content-Type: application/json
{ "email": "you@example.com", "password": "yourpassword" }
```

The session cookie is then sent automatically by the browser on subsequent requests. The web app proxy injects the required `x-api-key` header server-side — you do not need to send it manually.

## Endpoints

### Health

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Returns `{ status, database }` both `"ok"` or `"error"` |
| GET | `/stats` | Returns counts: `{ users, boards, lists, cards, checklistItems, checklists, labels }` |

### Users

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/users/me` | Get current user profile |
| PUT | `/users` | Update user. Body: `{ name?, image? }` |

### Boards

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/boards` | List all boards. Query: `type?=regular\|template` |
| GET | `/boards/:boardPublicId` | Get board with lists, cards, labels. Query: `members`, `labels`, `lists`, `dueDateFilters`, `type` |
| GET | `/boards/by-slug/:boardSlug` | Same as above but lookup by slug. Query: `members`, `labels`, `lists`, `dueDateFilters` |
| POST | `/boards/` | Create board. Body: `{ name, lists: string[], labels: string[], type?, sourceBoardPublicId? }` |
| PUT | `/boards/:boardPublicId` | Update board. Body: `{ name?, slug?, visibility? }`. Visibility: `"public" \| "private"` |
| DELETE | `/boards/:boardPublicId` | Soft-delete board and all child lists/cards |
| GET | `/boards/:boardPublicId/check-slug` | Check slug availability. Query: `boardSlug`. Returns `{ isReserved }` |

Board type: `"regular" | "template"`.

### Lists

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/lists/` | Create list. Body: `{ name, boardPublicId }` |
| PUT | `/lists/:listPublicId` | Update list. Body: `{ name?, index? }` |
| DELETE | `/lists/:listPublicId` | Soft-delete list and all child cards |

### Cards

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| POST | `/cards/` | `{ title, description, listPublicId, position, labelPublicIds?, dueDate? }` | Create card |
| GET | `/cards/:cardPublicId` | — | Get card with list info and labels |
| PUT | `/cards/:cardPublicId` | `{ title?, description?, index?, listPublicId?, dueDate? }` | Update card |
| DELETE | `/cards/:cardPublicId` | — | Soft-delete card |
| PUT | `/cards/:cardPublicId/labels/:labelPublicId` | — | Toggle label on card. Returns `{ newLabel: boolean }` |

`position` is `"start" | "end"` (not an object).
`description` is required on create (use `""` for empty).
`dueDate` is an ISO date string or `null`.

### Labels

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| GET | `/labels/:labelPublicId` | — | Get label details |
| POST | `/labels/` | `{ name, boardPublicId, colourCode }` | Create label |
| PUT | `/labels/:labelPublicId` | `{ name, colourCode }` | Update label (both fields required) |
| DELETE | `/labels/:labelPublicId` | — | Soft-delete label and remove from all cards |

`colourCode` is hex `#RRGGBB`.

### Checklists

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| POST | `/checklists/` | `{ cardPublicId, name }` | Create checklist |
| PUT | `/checklists/:checklistPublicId` | `{ name }` | Update checklist |
| DELETE | `/checklists/:checklistPublicId` | — | Soft-delete checklist and all items |
| POST | `/checklists/:checklistPublicId/items` | `{ title }` | Create checklist item |
| PATCH | `/checklists/items/:checklistItemPublicId` | `{ title?, completed?, index? }` | Update item |
| DELETE | `/checklists/items/:checklistItemPublicId` | — | Soft-delete item |

## Common Workflows

### Create a board with default columns

```
POST /api/boards/
{ "name": "My Project", "lists": ["Backlog", "In Progress", "Done"], "labels": ["Bug", "Feature", "Urgent"] }
```

### Add a task to a list

1. `GET /api/boards/` to find the board's `publicId`.
2. `GET /api/boards/:boardPublicId` to find the target list's `publicId`.
3. `POST /api/cards/` with `{ "title": "My task", "description": "", "listPublicId": "<id>", "position": "end" }`.

### Move a card to a different list

```
PUT /api/cards/:cardPublicId
{ "listPublicId": "<target-list-public-id>", "index": 0 }
```

### Toggle a label on a card

```
PUT /api/cards/:cardPublicId/labels/:labelPublicId
```

Returns `{ "newLabel": true }` if added, `{ "newLabel": false }` if removed.

### Add a checklist with items

1. `POST /api/checklists/` with `{ "cardPublicId": "<id>", "name": "Subtasks" }`.
2. `POST /api/checklists/:checklistPublicId/items` with `{ "title": "Step 1" }`.
3. `PATCH /api/checklists/items/:itemPublicId` with `{ "completed": true }` to check it off.

## Error Handling

All errors return JSON `{ error: string }` with standard HTTP status codes:
- **400** — validation failure or slug conflict
- **404** — resource not found
- **500** — server error

## Field Constraints

| Field | Constraint |
|-------|-----------|
| Board name | 1–100 chars |
| Card title | 1–2000 chars |
| Card description | max 10000 chars |
| Card position (create) | `"start"` or `"end"` |
| Label name | 1–36 chars |
| Label colourCode | hex `#RRGGBB` |
| Checklist name | 1–255 chars |
| Checklist item title | 1–500 chars |
| Due date filter values | `overdue`, `today`, `tomorrow`, `next-week`, `next-month`, `no-due-date` |
