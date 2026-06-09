# Obsidian Microblog Plugin — Spec

## Overview

An Obsidian plugin for practicing comedy writing. A personal micro-publishing tool with a Twitter-like feel, backed by a folder of individual markdown files in the user's vault (one file per post). Posts can be cross-posted to Bluesky/Mastodon via a share button.

The source of truth is a folder of markdown files — each post is its own note with YAML frontmatter for metadata. The plugin opens a timeline view over this folder. Multiple folders can each be opened in separate tabs. Obsidian handles sync, backup, and cross-platform support (desktop + mobile).

## Data Format

Each post is an individual markdown file in a folder. Any folder in the vault can be opened as a timeline via right-click → "Open as Timeline". The file name encodes timestamp for chronological sorting in the file explorer (e.g. `2026-06-09T143203.md`).

Each file has YAML frontmatter + markdown body:

```markdown
---
score: 3
---
Just realized "a watched pot never boils" is basically the
quantum observer effect but for pasta #physics #comedy
```

Frontmatter fields:

- `shared` — id of the post when it was cross-posted to social networks
- `score` — numeric, like reddit upvotes, user can modify manually to rank favorite posts
- Can contain more fields in the future as needed

Every post is a normal Obsidian note — visible in the file explorer, searchable via Obsidian's global search, editable by hand in the normal editor. Tags (hashtags in post body) are indexed by Obsidian's MetadataCache automatically. The timeline UI collects tags only from files in its folder, not from the entire vault.

## Navigation

- Right-click a folder in the file explorer → "Open as Timeline" opens that folder's timeline in a new tab.
- Each tab stores its folder path in the view's state (`getState()` / `setState()`), so multiple timeline folders can be open simultaneously in separate tabs.
- Each timeline view instance is independent — its own folder, search/filter state, and sort order.

## UI

Single-page React app, rendered in an Obsidian view pane. Stack: React + plain CSS (scoped under `.microblog-root`, themed via Obsidian's CSS variables to match the user's theme).

### Layout (top to bottom)

**Search & Sort Bar (top)**
- Search input. Typing text filters posts to those containing the text. X button clears the search.
- Clicking a hashtag in any post populates the search bar with that hashtag and filters automatically.
- Sorting dropdown: chronological order or by score.

**Timeline (middle)**
- Displays posts in chronological order, newest posts at the bottom.
- Each post displays its content, date, score, and hashtags.
- 300 character soft limit: content longer than 300 characters is hidden under a "read more" toggle.
- Each post has:
  - Edit button
  - Delete button
  - Upvote / downvote buttons (modify the post's score)
  - Share button — on click, cross-posts to Bluesky/Mastodon

**Editor (bottom)**
- Text input for writing new posts (markdown). Ideally, if we can figure it out, rendered the way obsidian notes are rendered (with all the markdown preview and styles, basically like a regular note).
- Circular progress bar indicator showing character count relative to 300 char limit. You can write longer than 300 chars — it just affects the "read more" threshold in the timeline.
- "NOTE" button to add the post to the timeline.

# Future features (not now)
## Cross-Posting 

- Each post has a "share" button. Clicking it sends the post to connected Bluesky and/or Mastodon accounts.
- Uses `@atproto/api` for Bluesky, Mastodon REST API for Mastodon.
- Store the external post ID back on the local record after sharing (set `shared: ID`).
- Share functionality may only work on desktop (Obsidian mobile lacks full Node.js). This is acceptable for MVP.

## Threading / Replies

Architect the data model to support replies from the start (the `reply_to` field). This enables:
- Threads for play-by-post roleplaying games (where I reply to my own posts creating threads within the timeline).

Not required for MVP UI, but the data model should support it.

## Technical Notes

- Plugin registers a custom Obsidian view and mounts the React app via `ReactDOM.createRoot(containerEl)`.
- **Data layer uses Obsidian APIs directly — no custom parser/serializer needed:**
  - Create post: `vault.create(path, frontmatter + body)`
  - Read posts: list markdown files in the view's folder, read frontmatter from `metadataCache` (already indexed)
  - Update frontmatter (score, shared, published): `fileManager.processFrontMatter(file, fn)` — atomic read-modify-write
  - Update body: `vault.modify(file, newContent)`
  - Delete post: `vault.delete(file)`
  - Tags: indexed automatically by Obsidian's `MetadataCache`, no manual parsing needed
- Plain CSS in a root `styles.css`, all rules scoped under `.microblog-root` to avoid collisions with Obsidian's styles; colors/spacing from Obsidian CSS variables.
- Bundle with esbuild (standard Obsidian plugin toolchain).
- Plugin settings: Bluesky credentials, Mastodon credentials.
