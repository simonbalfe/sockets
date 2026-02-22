---
name: kan-task-manager
description: Manage tasks on a Kan Kanban board via its REST API. Use when the agent needs to create, update, move, or delete cards (tasks) on a board; create or manage lists, labels, and checklists; or query board state. Triggers on any request involving task tracking, project management, or Kanban workflows backed by a running Kan instance.
---

# Kan Task Manager

Kan is a self-hosted Kanban board application. This skill enables interaction with its REST API to manage boards, lists, cards, labels, and checklists.

## Base URL

All endpoints are prefixed with `/api`. The url is `https://kan.simonbalfe.com`.

```bash
BASE="https://kan.simonbalfe.com/api"
AUTH="-H \"Authorization: Bearer kan_<your-token>\""
```

## Core Concepts

- **Board**: Top-level container holding lists and labels. Has a `publicId` and a unique `slug`.
- **List**: A column within a board (e.g., "To Do", "In Progress", "Done"). Contains cards ordered by `index`.
- **Card**: A task within a list. Supports descriptions, due dates, labels, and checklists.
- **Label**: A colored tag scoped to a board, applied to cards via toggle.
- **Checklist**: A named checklist attached to a card, containing ordered items with completion state.

All entities use `publicId` (12-char string) as the identifier in API paths. Internal numeric `id` is never used in requests.

Soft-delete is used throughout: deleted records keep their data but are excluded from queries.

## Authentication

All protected endpoints require a user API key sent as a Bearer token:

```
Authorization: Bearer kan_<token>
```

Keys never expire. Ask the user to provide their API key.

### Generating a key

A key can only be generated while authenticated via browser session. Once generated, store it for future use.

```bash
# While logged in via browser session:
curl $AUTH -X POST "$BASE/user-api-keys" \
  -b cookies.txt
# → { "key": "kan_abc123..." }
```

### Using the key

Include the `Authorization` header on every request. In the examples below, `$AUTH` expands to `-H "Authorization: Bearer kan_<token>"`.

```bash
AUTH="-H \"Authorization: Bearer kan_<your-token>\""
curl $AUTH "$BASE/boards"
```

## Endpoints

### Health

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Returns `{ status, database }` both `"ok"` or `"error"` |
| GET | `/stats` | Returns counts: `{ users, boards, lists, cards, checklistItems, checklists, labels }` |

```bash
curl $AUTH "$BASE/health"

curl $AUTH "$BASE/stats"
```

### Users

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/users/me` | Get current user profile |
| PUT | `/users/` | Update user. Body: `{ name?, image? }` |

```bash
curl $AUTH "$BASE/users/me"

curl $AUTH -X PUT "$BASE/users/" \
  -H "Content-Type: application/json" \
  -d '{"name": "Simon", "image": "https://example.com/avatar.png"}'
```

### Boards

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/boards/` | List all boards. Query: `type?=regular\|template` |
| GET | `/boards/:boardPublicId` | Get board with lists, cards, labels. Query filters: `members`, `labels`, `lists`, `dueDateFilters`, `type` |
| GET | `/boards/by-slug/:boardSlug` | Same as above but lookup by slug |
| POST | `/boards/` | Create board. Body: `{ name, lists: string[], labels: string[], type?, sourceBoardPublicId? }` |
| PUT | `/boards/:boardPublicId` | Update board. Body: `{ name?, slug?, visibility? }` |
| DELETE | `/boards/:boardPublicId` | Soft-delete board and all child lists/cards |
| GET | `/boards/:boardPublicId/check-slug` | Check slug availability. Query: `boardSlug`. Returns `{ isReserved }` |

```bash
curl $AUTH "$BASE/boards/"

curl $AUTH "$BASE/boards/?type=template"

curl $AUTH "$BASE/boards/AbCdEfGhIjKl"

curl $AUTH "$BASE/boards/by-slug/my-project"

curl $AUTH "$BASE/boards/AbCdEfGhIjKl?dueDateFilters=overdue&dueDateFilters=today"

curl $AUTH "$BASE/boards/AbCdEfGhIjKl?labels=LabelId00001&labels=LabelId00002"

curl $AUTH -X POST "$BASE/boards/" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Project", "lists": ["Backlog", "In Progress", "Done"], "labels": ["Bug", "Feature", "Urgent"]}'

curl $AUTH -X POST "$BASE/boards/" \
  -H "Content-Type: application/json" \
  -d '{"name": "Sprint Template", "lists": ["To Do", "Doing", "Review", "Done"], "labels": ["P0", "P1", "P2"], "type": "template"}'

curl $AUTH -X POST "$BASE/boards/" \
  -H "Content-Type: application/json" \
  -d '{"name": "Sprint 42", "lists": [], "labels": [], "sourceBoardPublicId": "TemplateId001"}'

curl $AUTH -X PUT "$BASE/boards/AbCdEfGhIjKl" \
  -H "Content-Type: application/json" \
  -d '{"name": "Renamed Project", "slug": "renamed-project", "visibility": "public"}'

curl $AUTH -X DELETE "$BASE/boards/AbCdEfGhIjKl"

curl $AUTH "$BASE/boards/AbCdEfGhIjKl/check-slug?boardSlug=my-slug"
```

### Lists

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/lists/` | Create list. Body: `{ name, boardPublicId }` |
| PUT | `/lists/:listPublicId` | Update list. Body: `{ name?, index? }` |
| DELETE | `/lists/:listPublicId` | Soft-delete list and all child cards |

```bash
curl $AUTH -X POST "$BASE/lists/" \
  -H "Content-Type: application/json" \
  -d '{"name": "QA Review", "boardPublicId": "AbCdEfGhIjKl"}'

curl $AUTH -X PUT "$BASE/lists/ListPublicId1" \
  -H "Content-Type: application/json" \
  -d '{"name": "Code Review"}'

curl $AUTH -X PUT "$BASE/lists/ListPublicId1" \
  -H "Content-Type: application/json" \
  -d '{"index": 0}'

curl $AUTH -X DELETE "$BASE/lists/ListPublicId1"
```

### Cards

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/cards/` | Create card. Body: `{ title, description?, listPublicId, labelPublicIds?, position, dueDate? }` |
| GET | `/cards/:cardPublicId` | Get card with list info and labels |
| PUT | `/cards/:cardPublicId` | Update card. Body: `{ title?, description?, index?, listPublicId?, dueDate? }` |
| DELETE | `/cards/:cardPublicId` | Soft-delete card |
| PUT | `/cards/:cardPublicId/labels/:labelPublicId` | Toggle label on card. Returns `{ newLabel: boolean }` |

```bash
curl $AUTH -X POST "$BASE/cards/" \
  -H "Content-Type: application/json" \
  -d '{"title": "Implement login page", "listPublicId": "ListPublicId1", "position": "start"}'

curl $AUTH -X POST "$BASE/cards/" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix auth bug",
    "description": "Token expires too early when using refresh flow",
    "listPublicId": "ListPublicId1",
    "labelPublicIds": ["LabelId00001", "LabelId00002"],
    "position": "end",
    "dueDate": "2026-02-25T00:00:00.000Z"
  }'

curl $AUTH "$BASE/cards/CardPublicId1"

curl $AUTH -X PUT "$BASE/cards/CardPublicId1" \
  -H "Content-Type: application/json" \
  -d '{"title": "Implement login page (v2)"}'

curl $AUTH -X PUT "$BASE/cards/CardPublicId1" \
  -H "Content-Type: application/json" \
  -d '{"description": "Updated requirements: support SSO"}'

curl $AUTH -X PUT "$BASE/cards/CardPublicId1" \
  -H "Content-Type: application/json" \
  -d '{"dueDate": "2026-03-01T00:00:00.000Z"}'

curl $AUTH -X PUT "$BASE/cards/CardPublicId1" \
  -H "Content-Type: application/json" \
  -d '{"dueDate": null}'

curl $AUTH -X PUT "$BASE/cards/CardPublicId1" \
  -H "Content-Type: application/json" \
  -d '{"listPublicId": "ListPublicId2", "index": 0}'

curl $AUTH -X PUT "$BASE/cards/CardPublicId1" \
  -H "Content-Type: application/json" \
  -d '{"index": 2}'

curl $AUTH -X DELETE "$BASE/cards/CardPublicId1"

curl $AUTH -X PUT "$BASE/cards/CardPublicId1/labels/LabelId00001"
```

### Labels

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/labels/:labelPublicId` | Get label details |
| POST | `/labels/` | Create label. Body: `{ name, boardPublicId, colourCode }` (`colourCode` is hex `#RRGGBB`) |
| PUT | `/labels/:labelPublicId` | Update label. Body: `{ name, colourCode }` |
| DELETE | `/labels/:labelPublicId` | Soft-delete label and remove from all cards |

```bash
curl $AUTH "$BASE/labels/LabelId00001"

curl $AUTH -X POST "$BASE/labels/" \
  -H "Content-Type: application/json" \
  -d '{"name": "Critical", "boardPublicId": "AbCdEfGhIjKl", "colourCode": "#ef4444"}'

curl $AUTH -X PUT "$BASE/labels/LabelId00001" \
  -H "Content-Type: application/json" \
  -d '{"name": "High Priority", "colourCode": "#f97316"}'

curl $AUTH -X DELETE "$BASE/labels/LabelId00001"
```

### Checklists

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/checklists/` | Create checklist. Body: `{ cardPublicId, name }` |
| PUT | `/checklists/:checklistPublicId` | Update checklist. Body: `{ name }` |
| DELETE | `/checklists/:checklistPublicId` | Soft-delete checklist and all items |
| POST | `/checklists/:checklistPublicId/items` | Create item. Body: `{ title }` |
| PATCH | `/checklists/items/:checklistItemPublicId` | Update item. Body: `{ title?, completed?, index? }` |
| DELETE | `/checklists/items/:checklistItemPublicId` | Soft-delete item |

```bash
curl $AUTH -X POST "$BASE/checklists/" \
  -H "Content-Type: application/json" \
  -d '{"cardPublicId": "CardPublicId1", "name": "Acceptance Criteria"}'

curl $AUTH -X PUT "$BASE/checklists/ChkListPubId1" \
  -H "Content-Type: application/json" \
  -d '{"name": "Definition of Done"}'

curl $AUTH -X DELETE "$BASE/checklists/ChkListPubId1"

curl $AUTH -X POST "$BASE/checklists/ChkListPubId1/items" \
  -H "Content-Type: application/json" \
  -d '{"title": "Unit tests pass"}'

curl $AUTH -X POST "$BASE/checklists/ChkListPubId1/items" \
  -H "Content-Type: application/json" \
  -d '{"title": "Code reviewed"}'

curl $AUTH -X PATCH "$BASE/checklists/items/ChkItemPubId1" \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'

curl $AUTH -X PATCH "$BASE/checklists/items/ChkItemPubId1" \
  -H "Content-Type: application/json" \
  -d '{"completed": false}'

curl $AUTH -X PATCH "$BASE/checklists/items/ChkItemPubId1" \
  -H "Content-Type: application/json" \
  -d '{"title": "All unit tests pass"}'

curl $AUTH -X PATCH "$BASE/checklists/items/ChkItemPubId1" \
  -H "Content-Type: application/json" \
  -d '{"index": 0}'

curl $AUTH -X DELETE "$BASE/checklists/items/ChkItemPubId1"
```

## Common Workflows

### 1. Set up a new project board from scratch

```bash
# Create the board with columns and labels
curl $AUTH -X POST "$BASE/boards/" \
  -H "Content-Type: application/json" \
  -d '{"name": "Website Redesign", "lists": ["Backlog", "In Progress", "Review", "Done"], "labels": ["Bug", "Feature", "Design", "Urgent"]}'

# Response includes the board publicId — use it for subsequent calls
# e.g. board.publicId = "Brd_AbCd1234"
```

### 2. Add a task to a board

```bash
# Step 1: Get the board to find list publicIds
curl $AUTH "$BASE/boards/Brd_AbCd1234"
# Find the target list's publicId from the response, e.g. "Lst_Backlog01"

# Step 2: Create the card in that list
curl $AUTH -X POST "$BASE/cards/" \
  -H "Content-Type: application/json" \
  -d '{"title": "Redesign homepage hero section", "description": "New hero with animated gradient background", "listPublicId": "Lst_Backlog01", "position": "start"}'
```

### 3. Move a card between lists (e.g. "In Progress" → "Review")

```bash
curl $AUTH -X PUT "$BASE/cards/Card_TaskId01" \
  -H "Content-Type: application/json" \
  -d '{"listPublicId": "Lst_Review001", "index": 0}'
```

### 4. Reorder a card within its current list

```bash
# Move card to position 2 (0-based) in its current list
curl $AUTH -X PUT "$BASE/cards/Card_TaskId01" \
  -H "Content-Type: application/json" \
  -d '{"index": 2}'
```

### 5. Tag a card with labels

```bash
# Toggle labels on — call once to add, call again to remove
curl $AUTH -X PUT "$BASE/cards/Card_TaskId01/labels/Lbl_Feature01"
# → {"newLabel": true}   (added)

curl $AUTH -X PUT "$BASE/cards/Card_TaskId01/labels/Lbl_Urgent001"
# → {"newLabel": true}   (added)

# Toggle off by calling again
curl $AUTH -X PUT "$BASE/cards/Card_TaskId01/labels/Lbl_Urgent001"
# → {"newLabel": false}  (removed)
```

### 6. Set and clear a due date

```bash
# Set a due date
curl $AUTH -X PUT "$BASE/cards/Card_TaskId01" \
  -H "Content-Type: application/json" \
  -d '{"dueDate": "2026-03-15T00:00:00.000Z"}'

# Clear the due date
curl $AUTH -X PUT "$BASE/cards/Card_TaskId01" \
  -H "Content-Type: application/json" \
  -d '{"dueDate": null}'
```

### 7. Add a checklist with items to a card

```bash
# Create the checklist
curl $AUTH -X POST "$BASE/checklists/" \
  -H "Content-Type: application/json" \
  -d '{"cardPublicId": "Card_TaskId01", "name": "Launch Checklist"}'
# → returns checklist with publicId, e.g. "Chk_Launch001"

# Add items
curl $AUTH -X POST "$BASE/checklists/Chk_Launch001/items" \
  -H "Content-Type: application/json" \
  -d '{"title": "Run full test suite"}'

curl $AUTH -X POST "$BASE/checklists/Chk_Launch001/items" \
  -H "Content-Type: application/json" \
  -d '{"title": "Update changelog"}'

curl $AUTH -X POST "$BASE/checklists/Chk_Launch001/items" \
  -H "Content-Type: application/json" \
  -d '{"title": "Deploy to production"}'
```

### 8. Complete checklist items

```bash
# Mark items as done
curl $AUTH -X PATCH "$BASE/checklists/items/ChkItem00001" \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'

curl $AUTH -X PATCH "$BASE/checklists/items/ChkItem00002" \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'

# Undo if needed
curl $AUTH -X PATCH "$BASE/checklists/items/ChkItem00002" \
  -H "Content-Type: application/json" \
  -d '{"completed": false}'
```

### 9. Filter a board view

```bash
# Cards with overdue or today's due dates
curl $AUTH "$BASE/boards/Brd_AbCd1234?dueDateFilters=overdue&dueDateFilters=today"

# Cards in specific lists only
curl $AUTH "$BASE/boards/Brd_AbCd1234?lists=Lst_InProg001&lists=Lst_Review001"

# Cards with specific labels
curl $AUTH "$BASE/boards/Brd_AbCd1234?labels=Lbl_Bug00001&labels=Lbl_Urgent001"

# Combine filters
curl $AUTH "$BASE/boards/Brd_AbCd1234?dueDateFilters=overdue&labels=Lbl_Urgent001"
```

### 10. Clone a board from a template

```bash
# Create a template board
curl $AUTH -X POST "$BASE/boards/" \
  -H "Content-Type: application/json" \
  -d '{"name": "Sprint Template", "lists": ["To Do", "In Progress", "Testing", "Done"], "labels": ["P0", "P1", "P2"], "type": "template"}'
# → returns template board, e.g. publicId "Tmpl_Sprint01"

# Clone it for a new sprint
curl $AUTH -X POST "$BASE/boards/" \
  -H "Content-Type: application/json" \
  -d '{"name": "Sprint 42", "lists": [], "labels": [], "sourceBoardPublicId": "Tmpl_Sprint01"}'
```

### 11. Rename and reorder lists

```bash
# Rename a list
curl $AUTH -X PUT "$BASE/lists/Lst_InProg001" \
  -H "Content-Type: application/json" \
  -d '{"name": "Work In Progress"}'

# Move a list to position 0 (first column)
curl $AUTH -X PUT "$BASE/lists/Lst_Review001" \
  -H "Content-Type: application/json" \
  -d '{"index": 0}'
```

### 12. Manage labels on a board

```bash
# Create a new label
curl $AUTH -X POST "$BASE/labels/" \
  -H "Content-Type: application/json" \
  -d '{"name": "Blocked", "boardPublicId": "Brd_AbCd1234", "colourCode": "#dc2626"}'

# Update its color
curl $AUTH -X PUT "$BASE/labels/Lbl_Blocked01" \
  -H "Content-Type: application/json" \
  -d '{"name": "Blocked", "colourCode": "#991b1b"}'

# Delete it (also removes from all cards)
curl $AUTH -X DELETE "$BASE/labels/Lbl_Blocked01"
```

### 13. Add a list to an existing board

```bash
curl $AUTH -X POST "$BASE/lists/" \
  -H "Content-Type: application/json" \
  -d '{"name": "Deployed", "boardPublicId": "Brd_AbCd1234"}'
```

### 14. Clean up — delete a board and everything in it

```bash
# Soft-deletes the board, all its lists, and all cards
curl $AUTH -X DELETE "$BASE/boards/Brd_AbCd1234"
```

### 15. Get system stats

```bash
curl $AUTH "$BASE/stats"
# → {"users":1,"boards":3,"lists":12,"cards":47,"checklistItems":15,"checklists":5,"labels":9}
```

## Knowledge Base

The knowledge base stores user-scoped resources (links, videos, PDFs, social posts, creators, etc.) with their own label system separate from board labels.

### Knowledge Items

| Method | Path | Body / Query | Purpose |
|--------|------|--------------|---------|
| GET | `/knowledge-items` | — | List all knowledge items for current user |
| GET | `/knowledge-items/search` | Query: `type`, `label` | Filter items by type and/or label |
| GET | `/knowledge-items/:publicId` | — | Get knowledge item by publicId |
| POST | `/knowledge-items` | `{ title, type, url?, description? }` | Create knowledge item |
| PUT | `/knowledge-items/:publicId` | `{ title?, type?, url?, description? }` | Update knowledge item |
| DELETE | `/knowledge-items/:publicId` | — | Soft-delete knowledge item |
| PUT | `/knowledge-items/:publicId/labels/:labelPublicId` | — | Toggle label. Returns `{ added: boolean }` |

Knowledge item `type`: `"link" | "creator" | "tweet" | "instagram" | "tiktok" | "youtube" | "linkedin" | "image" | "video" | "pdf" | "audio" | "other"`.

### Search / Filter

`GET /knowledge-items/search` accepts optional query params:

| Param | Format | Purpose |
|-------|--------|---------|
| `type` | Comma-separated or repeated | Filter by item type(s) |
| `label` | Comma-separated or repeated | Filter by label publicId(s) |

```bash
# All TikToks
curl $AUTH "$BASE/knowledge-items/search?type=tiktok"

# TikToks and Instagram posts
curl $AUTH "$BASE/knowledge-items/search?type=tiktok,instagram"

# YouTube items with a specific label
curl $AUTH "$BASE/knowledge-items/search?type=youtube&label=abc123def456"
```

### Knowledge Labels

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| GET | `/knowledge-items/labels/all` | — | List all knowledge labels |
| POST | `/knowledge-items/labels` | `{ name, colourCode }` | Create label |
| PUT | `/knowledge-items/labels/:labelPublicId` | `{ name, colourCode }` | Update label |
| DELETE | `/knowledge-items/labels/:labelPublicId` | — | Soft-delete label |

```bash
# Save a TikTok
curl $AUTH -X POST "$BASE/knowledge-items" \
  -H "Content-Type: application/json" \
  -d '{"title": "Viral hook format", "type": "tiktok", "url": "https://tiktok.com/@user/video/123"}'

# Create a label and tag the item
curl $AUTH -X POST "$BASE/knowledge-items/labels" \
  -H "Content-Type: application/json" \
  -d '{"name": "Repurpose", "colourCode": "#3b82f6"}'

curl $AUTH -X PUT "$BASE/knowledge-items/ItemPublicId/labels/LabelPublicId"
```

## Error Handling

All errors return JSON `{ error: string }` with standard HTTP status codes:
- **400** — validation failure or slug conflict
- **404** — resource not found
- **500** — server error

```bash
# Example: creating a card with missing required field
curl $AUTH -X POST "$BASE/cards/" \
  -H "Content-Type: application/json" \
  -d '{"title": "Oops"}'
# → 400 {"error": "..."}

# Example: fetching a non-existent card
curl $AUTH "$BASE/cards/doesNotExist"
# → 404 {"error": "Card not found"}
```

## Field Constraints

| Field | Constraint |
|-------|-----------|
| Board name | 1–100 chars |
| Card title | 1–2000 chars |
| Card description | max 10000 chars |
| Card position | `"start"` or `"end"` |
| Card dueDate | ISO 8601 string or `null` |
| Label name | 1–36 chars |
| Label colourCode | hex `#RRGGBB` |
| Checklist name | 1–255 chars |
| Checklist item title | 1–500 chars |
| Knowledge item title | 1–255 chars |
| Knowledge item type | `link`, `creator`, `tweet`, `instagram`, `tiktok`, `youtube`, `linkedin`, `image`, `video`, `pdf`, `audio`, `other` |
| Knowledge label name | 1–255 chars |
| Knowledge label colourCode | max 12 chars |
