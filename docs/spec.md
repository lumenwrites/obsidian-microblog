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
- `reply_to` — id (filename stem) of the parent post, for threads
- `done` — ISO timestamp set when the post is marked done (absent = not done)
- `tags` — a YAML list of tags (standard Obsidian frontmatter tags)
- Can contain more fields in the future as needed

Every post is a normal Obsidian note — visible in the file explorer, searchable via Obsidian's global search, editable by hand in the normal editor. **Tags are a structured frontmatter field** (`tags`), written via the composer's tag input and shown as chips on each post — not inline `#hashtags` in the body. They're still standard Obsidian tags (so the global tag pane / search see them). The timeline's tag autocomplete collects tags only from files in its folder, not the whole vault. (Inline `#hashtags` typed into a body still render as clickable Obsidian tags, but aren't part of the structured `tags` field.)

## Navigation

- Right-click a folder in the file explorer → "Open as Timeline" opens that folder's timeline in a new tab.
- Each tab stores its folder path in the view's state (`getState()` / `setState()`), so multiple timeline folders can be open simultaneously in separate tabs.
- Each timeline view instance is independent — its own folder, search/filter state, and sort order.

## UI

Single-page React app, rendered in an Obsidian view pane. Stack: React + plain CSS (scoped under `.microblog-root`, themed via Obsidian's CSS variables to match the user's theme).

### Layout (top to bottom)

**Search & Sort Bar (top)**
- Search input. Typing text filters posts whose body or tags contain it. A `#tag` query filters by exact tag membership instead. X button clears the search.
- Clicking a tag chip (or an inline tag in a post) puts `#tag` in the search bar, filtering to posts that have that tag.
- Sorting dropdown: Newest (chronological), Top (by score), or **Resurface** — a review-priority order that floats up stale, high-scored posts (so good old material periodically resurfaces); interacting with a post (edit/upvote/done) bumps its modified time and sends it back down to climb again.
- Filter dropdown: **All / Not done / Done** — filters by the `done` frontmatter flag.

**Timeline (middle)**
- Displays posts in chronological order, newest posts at the bottom.
- Each post displays its content, its tags (as rounded chips on the left of the footer, click to filter), date, and score.
- 300 character soft limit: content longer than 300 characters is hidden under a "read more" toggle.
- Each post has:
  - Upvote / downvote buttons (modify the post's score)
  - Edit button — opens the real note in Obsidian's editor
  - A ⋯ menu with: Done (toggles a `done: <timestamp>` frontmatter flag; the menu icon is a square that becomes a check, and done posts show a check in their footer); Reply (starts a reply, forming a thread — see Threads below); Share (cross-post to Bluesky/Mastodon — planned; placeholder for now); Archive (moves the note into an `archived/` subfolder of the timeline folder); Delete (moves the note into a `trash/` subfolder, beside `archived/`). Both leave the timeline and stats but stay in the vault — reversible (move them back), and either subfolder can itself be opened as a timeline. Delete has no confirmation.

**Threads / Replies**
- Any post can reply to another (stored as a quoted `reply_to: "<parent-id>"` in frontmatter, where the id is the parent's filename stem). Replies nest under their parent in the timeline, indented with a thread line (indentation caps at depth 5 so deep chains stay readable). Enables play-by-post roleplaying threads (replying to your own posts).
- Clicking Reply sets a "Replying to …" banner on the composer (with cancel); submitting writes the link. A reply whose parent is missing (renamed/deleted) renders as a top-level post.
- Threading shows in the browsing views; an active search flattens to the matching posts.

**Stats widget (attached to the composer)**
- A 30-day contribution graph — one rounded square per day, fill scaling with that day's progress toward the daily goal (pale at the first post, fully saturated at the goal). Today's square is outlined. Fill includes backfill (the same surplus-flows-backward rule as the streak), so a repaired day shows as filled; its tooltip notes "(backfilled)".
- A **streak** (🔥) — consecutive days the goal was met, ending today. Backfillable: surplus posts beyond the goal flow backward to repair skipped days within the last 14 days (so an off day or two is forgiven). An in-progress today gets a grace day.
- A **total** (▪) — all-time post count in the folder.
- Per folder; visible by default, hideable via **Show stats**. Daily goal is configurable (default 3). Replies count toward goal and total.

**Editor (bottom)**
- A tag input sits to the left of the char-count ring: type tags (autocompleting against the folder's existing tags, or create new ones); space or comma commits a tag, Enter accepts the highlighted suggestion, Backspace on an empty field removes the last tag. Committed tags become removable chips and are written to the new post's `tags` frontmatter.
- Auto-growing textarea for writing new posts in markdown (Cmd/Ctrl+Enter submits). The composer is a plain textarea, not a live-preview editor — but **posts in the timeline render the way Obsidian renders notes** (via `MarkdownRenderer`), and the per-post **Edit** action opens the real note in Obsidian's own editor for full editing.
- Circular progress bar indicator showing character count relative to 300 char limit. You can write longer than 300 chars — it just affects the "read more" threshold in the timeline.
- "NOTE" button to add the post to the timeline.

# Future features (not now)
## Cross-Posting 

- Each post has a "share" button. Clicking it sends the post to connected Bluesky and/or Mastodon accounts.
- Uses `@atproto/api` for Bluesky, Mastodon REST API for Mastodon.
- Store the external post ID back on the local record after sharing (set `shared: ID`).
- Share functionality may only work on desktop (Obsidian mobile lacks full Node.js). This is acceptable for MVP.

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
