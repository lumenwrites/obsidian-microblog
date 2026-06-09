# Plan: The timeline feature

Build the actual product on top of the scaffold (see `architecture.md`): read a folder of post files, render them as a timeline, and compose new posts. Replaces the smoke-screen `<App>`.

Source of truth for behavior is `spec.md`. The scaffold (plugin/view/context/settings/build) is done; this plan is the data layer + reactivity + UI.

## Key design (APIs confirmed against Obsidian docs)

1. **Data layer** — `src/lib/posts.ts`, mapping file ↔ `Post` (type already in `src/types/index.ts`). No custom parser:
   - Create: `vault.create(path, frontmatter + body)`. Filename encodes the timestamp (`2026-06-09T143203.md`) → chronological sort.
   - Read: list markdown files in the view's folder; `metadataCache.getFileCache(file).frontmatter` (score/shared/reply_to) and `.tags` (hashtags).
   - Update score/shared: `fileManager.processFrontMatter(file, fn)` — atomic read-modify-write.
   - Update body: `vault.process(file, fn)` (preferred) / `vault.modify`.
   - Delete: `vault.delete(file)`.
   - **Scope every path under the view's `folderPath`** — we run in the primary vault; never touch arbitrary paths.

2. **Reactivity bridge** — `src/hooks/usePosts.ts`. The timeline must update when files change on disk (hand-edits, deletes, our own writes). Subscribe to `vault.on('create'|'modify'|'delete'|'rename')` + `metadataCache.on('changed')`, **registered inside `workspace.onLayoutReady`** (else `create` fires for every file at startup), filtered to the view's folder, pushing results into React state. Register via `registerEvent` so they're torn down.

3. **Markdown rendering (output)** — `src/components/MarkdownPreview.tsx`. Render post bodies the way Obsidian renders notes: `MarkdownRenderer.render(app, markdown, el, sourcePath, component)` into a ref'd `<div>`. Three correctness details:
   - (a) Create a **per-post child `Component`** in the effect and `unload()` it on cleanup, so embeds/links/post-processors register *and* unregister.
   - (b) Pass **`sourcePath` = the post's file path** so relative links, embeds, and `[[wikilinks]]` resolve (each post is a real note).
   - (c) **`el.empty()` before re-rendering** on edit/score change so DOM doesn't stack.

4. **UI** (per `spec.md`, top→bottom): search/sort bar → timeline (newest at bottom, 300-char "read more" fold via `settings.charLimit`, edit/delete/upvote/downvote/share per post) → composer (auto-growing textarea via `react-textarea-autosize`, circular char-count indicator, NOTE button). FontAwesome for in-app icons.

**Editor — keep it simple.** Composer is a plain `react-textarea-autosize` textarea; no inline live-preview editor (only undocumented internal hacks exist, which break across versions and flag in review). Post bodies render via `MarkdownRenderer` (output side); the **Edit** action opens the post's real note in a normal Obsidian editor for full editing. The textarea only composes new short posts. (If composer live-preview is ever wanted, the internal `EmbeddableMarkdownEditor` is a contained post-MVP spike with the textarea as fallback — not planned.)

## TODO

- [ ] `src/lib/posts.ts` — file ↔ `Post` CRUD over vault/metadataCache/fileManager, scoped to `folderPath`; filename timestamp helpers.
- [ ] `src/hooks/usePosts.ts` — read folder + subscribe to vault/metadataCache events (inside `onLayoutReady`) → React state.
- [ ] `src/components/MarkdownPreview.tsx` — render body via `MarkdownRenderer.render` with the three correctness details above.
- [ ] Timeline UI: search/sort bar, post list (read-more fold, edit/delete/upvote/downvote/share), composer (textarea + circular char count + NOTE).
- [ ] Wire `<App>` to the above; remove the smoke screen.
- [ ] Verify: posts read/create/edit/delete/score live-update across tabs; theme colors correct; `npm run build` + `npm run lint` clean.
- [ ] Update `spec.md` (Implemented) + `architecture.md` (data flow) to match what shipped; delete this plan.

## DONE

(nothing yet — scaffold is in `architecture.md`)
