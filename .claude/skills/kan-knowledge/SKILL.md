---
name: kan-knowledge
description: Manage knowledge items via the Kan REST API. Use when the agent needs to save, update, delete, label, or list knowledge items (links, videos, PDFs, creators, social posts, etc.) or manage knowledge labels. Triggers on any request involving knowledge base management, saving resources, bookmarking links, or tagging saved content.
---

# Kan Knowledge Base

The knowledge base is part of Kan, a self-hosted Kanban board application backed by a Hono API. Knowledge items are user-scoped saved resources (links, videos, PDFs, etc.) with their own label system separate from board labels.

## Base URL

All endpoints are prefixed with `/api`. The url is `https://kan.simonbalfe.com`.

**IMPORTANT**: Do NOT use trailing slashes on any API paths. Use `/api/knowledge-items` not `/api/knowledge-items/`. Trailing slashes return 404.

## Core Concepts

- **Knowledge Item**: A saved resource (link, creator, video, social post, PDF, etc.) scoped to the current user.
- **Knowledge Label**: A colored tag for knowledge items. Separate from board labels.
- **Type (Category)**: Every knowledge item has a type that categorizes it by platform or format.

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
curl -H "Authorization: Bearer kan_abc123..." https://kan.simonbalfe.com/api/knowledge-items
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

### Knowledge Items

| Method | Path | Body / Query | Purpose |
|--------|------|--------------|---------|
| GET | `/knowledge-items` | — | List all knowledge items for current user |
| GET | `/knowledge-items/search` | Query: `type`, `label` | Filter items by type and/or label |
| GET | `/knowledge-items/:publicId` | — | Get knowledge item by publicId |
| POST | `/knowledge-items` | `{ title, type, url?, description? }` | Create knowledge item |
| PUT | `/knowledge-items/:publicId` | `{ title?, type?, url?, description? }` | Update knowledge item (at least one field required) |
| DELETE | `/knowledge-items/:publicId` | — | Soft-delete knowledge item |
| PUT | `/knowledge-items/:publicId/labels/:labelPublicId` | — | Toggle label on knowledge item. Returns `{ added: boolean }` |

Knowledge item `type` is one of: `"link" | "creator" | "tweet" | "instagram" | "tiktok" | "youtube" | "linkedin" | "image" | "video" | "pdf" | "audio" | "other"`.

### Search / Filter

`GET /knowledge-items/search` accepts optional query parameters:

| Param | Format | Purpose |
|-------|--------|---------|
| `type` | Comma-separated or repeated | Filter by item type(s) |
| `label` | Comma-separated or repeated | Filter by label publicId(s) |

Both params are optional. When both are provided, items must match the type filter AND have at least one of the specified labels.

Examples:
- `/knowledge-items/search?type=tiktok` — all TikToks
- `/knowledge-items/search?type=tiktok,instagram` — TikToks and Instagram posts
- `/knowledge-items/search?label=abc123def456` — items with a specific label
- `/knowledge-items/search?type=youtube&label=abc123def456` — YouTube items with a specific label
- `/knowledge-items/search?type=tiktok&type=instagram` — repeated params also work

Invalid type values are silently ignored. If no valid types remain after filtering, the type filter is skipped.

### Knowledge Labels

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| GET | `/knowledge-items/labels/all` | — | List all knowledge labels for current user |
| POST | `/knowledge-items/labels` | `{ name, colourCode }` | Create knowledge label |
| PUT | `/knowledge-items/labels/:labelPublicId` | `{ name, colourCode }` | Update knowledge label (both fields required) |
| DELETE | `/knowledge-items/labels/:labelPublicId` | — | Soft-delete knowledge label |

## Common Workflows

### Save a knowledge item

```
POST /api/knowledge-items
{ "title": "Viral TikTok trend", "type": "tiktok", "url": "https://tiktok.com/@user/video/123", "description": "Good hook format" }
```

### Tag a knowledge item with a label

1. `POST /api/knowledge-items/labels` with `{ "name": "Repurpose", "colourCode": "#3b82f6" }`.
2. `PUT /api/knowledge-items/:publicId/labels/:labelPublicId` to toggle the label.

### Get all TikToks

```
GET /api/knowledge-items/search?type=tiktok
```

### Get all Instagram posts with a specific label

```
GET /api/knowledge-items/search?type=instagram&label=<labelPublicId>
```

### Get all items across multiple platforms

```
GET /api/knowledge-items/search?type=tiktok,instagram,youtube
```

### Get all items with multiple labels

```
GET /api/knowledge-items/search?label=<labelPublicId1>,<labelPublicId2>
```

Items matching any of the specified labels are returned.

### List all saved items (unfiltered)

```
GET /api/knowledge-items
```

### Remove a label from a knowledge item

Toggle labels are idempotent — call the same toggle endpoint again to remove:

```
PUT /api/knowledge-items/:publicId/labels/:labelPublicId
```

Returns `{ "added": true }` if added, `{ "added": false }` if removed.

## Error Handling

All errors return JSON `{ error: string }` with standard HTTP status codes:
- **400** — validation failure
- **404** — resource not found
- **500** — server error

## Field Constraints

| Field | Constraint |
|-------|-----------|
| Knowledge item title | 1–255 chars |
| Knowledge item type | one of: `link`, `creator`, `tweet`, `instagram`, `tiktok`, `youtube`, `linkedin`, `image`, `video`, `pdf`, `audio`, `other` |
| Knowledge label name | 1–255 chars |
| Knowledge label colourCode | max 12 chars |
