---
name: kan-knowledge
description: Manage knowledge items via the Kan REST API. Use when the agent needs to save, update, delete, label, or list knowledge items (links, videos, PDFs, creators, social posts, etc.) or manage knowledge labels. Triggers on any request involving knowledge base management, saving resources, bookmarking links, or tagging saved content.
---

# Kan Knowledge Base

Save and manage resources (links, videos, social posts, PDFs, etc.) via the Kan REST API.

## Connection

- **Base**: `https://kan.simonbalfe.com/api`
- **Auth**: `Authorization: Bearer kan_sk_e010d8219402cfc8f9215e765dcfc`
- **No trailing slashes** — `/api/knowledge-items` not `/api/knowledge-items/`

## Auto-Categorization

When saving a URL, **always detect the type automatically** from the URL before creating the item. Do NOT ask the user what type it is.

### URL → Type Detection

| URL hostname contains | Type |
|----------------------|------|
| `x.com`, `twitter.com` | `tweet` |
| `instagram.com` | `instagram` |
| `tiktok.com` | `tiktok` |
| `youtube.com`, `youtu.be` | `youtube` |
| `linkedin.com` | `linkedin` |

### File extension → Type Detection

| Extensions | Type |
|-----------|------|
| jpg, jpeg, png, gif, webp, svg, avif | `image` |
| mp4, mov, webm, avi, mkv | `video` |
| mp3, wav, ogg, flac, aac, m4a | `audio` |
| pdf | `pdf` |

### Default

If no pattern matches, use `"link"`.

### Other valid types

`creator`, `app`, `other` — use these only when the user explicitly specifies them.

## Endpoints

### Knowledge Items

| Method | Path | Body / Query | Purpose |
|--------|------|--------------|---------|
| GET | `/knowledge-items` | — | List all items |
| GET | `/knowledge-items/search` | `?type=&label=` | Filter by type and/or label |
| GET | `/knowledge-items/:publicId` | — | Get single item |
| POST | `/knowledge-items` | `{ title, type, url?, description? }` | Create item |
| PUT | `/knowledge-items/:publicId` | `{ title?, type?, url?, description? }` | Update item (min 1 field) |
| DELETE | `/knowledge-items/:publicId` | — | Soft-delete item |
| PUT | `/knowledge-items/:publicId/labels/:labelPublicId` | — | Toggle label (returns `{ added: boolean }`) |

### Search

`GET /knowledge-items/search` query params:

- `type` — comma-separated types: `/search?type=tiktok,youtube`
- `label` — comma-separated label publicIds: `/search?label=abc123,def456`

Both optional. When both present, items must match type AND have at least one label.

### Labels

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| GET | `/knowledge-items/labels/all` | — | List all labels |
| POST | `/knowledge-items/labels` | `{ name, colourCode }` | Create label |
| PUT | `/knowledge-items/labels/:labelPublicId` | `{ name, colourCode }` | Update label |
| DELETE | `/knowledge-items/labels/:labelPublicId` | — | Soft-delete label |

## Saving a Link (Standard Flow)

1. Detect type from the URL using the rules above.
2. Use the page title or a concise description as `title`. If uncertain, use the URL domain + path as title.
3. POST to `/knowledge-items` with `{ title, type, url }`.
4. Do NOT auto-label. Labels are applied manually by the user.

## Field Constraints

| Field | Constraint |
|-------|-----------|
| title | 1–255 chars |
| type | `link`, `creator`, `tweet`, `instagram`, `tiktok`, `youtube`, `linkedin`, `image`, `video`, `pdf`, `audio`, `app`, `other` |
| label name | 1–255 chars |
| label colourCode | max 12 chars (hex) |

## Errors

JSON `{ error: string }` with status 400 (validation), 404 (not found), or 500 (server).
