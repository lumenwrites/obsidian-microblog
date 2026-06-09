# Architecture

How the plugin is built: the Obsidian↔React boundary, file map, state/settings flow, styling, and build. Read this before working on the plugin. For *what* it does, see `spec.md`; for *how to write code* here, see `best-practices.md`.

## The big picture

This is a **single-page React app hosted inside an Obsidian view**. There's a thin Obsidian integration layer at the edges (a `Plugin` and an `ItemView`), and everything inside is ordinary React/TypeScript. Obsidian's `App`/`Vault`/`Workspace`/`MetadataCache` are reachable from any component through a context hook.

```
Obsidian
  └─ MicroblogPlugin (src/main.ts)            ← long-lived host: settings, view registration, ribbon, command, folder menu
       └─ TimelineView : ItemView (src/view.tsx)   ← one per tab; mounts/unmounts the React root
            └─ <PluginProvider> (src/context/PluginContext.tsx)   ← exposes plugin/app/settings/folderPath
                 └─ <App> (src/app.tsx)            ← the SPA: search bar + timeline + composer (currently a smoke screen)
```

## The Obsidian↔React boundary (the core pattern)

1. **`MicroblogPlugin`** (`src/main.ts`) is the long-lived host. It loads/saves settings, registers the view type, the ribbon icon, the "Open timeline" command, the folder "Open as timeline" context-menu item, and the settings tab. **State that must outlive a React mount lives on the plugin instance, not in React** — the React tree mounts and unmounts every time a tab opens/closes.

2. **`TimelineView`** (`src/view.tsx`) extends `ItemView` and is the bridge. `onOpen()` adds the `microblog-root` class to `contentEl` (CSS scope) and creates the React root with `createRoot()`. `onClose()` calls `root.unmount()` — **this is mandatory**; a leaked root is a top cause of plugin bugs.

3. **`PluginProvider`** (`src/context/PluginContext.tsx`) is the single context provider. It carries the plugin instance (and through it `app` and live `settings`) plus this view's `folderPath`. Components read them through hooks instead of prop-drilling:
   - `usePlugin()` → the `MicroblogPlugin` instance
   - `useApp()` → the Obsidian `App`
   - `useSettings()` → live `MicroblogSettings`
   - `useFolderPath()` → this view's folder path

## State-bearing, multi-instance view

The view is **not a singleton**. Each tab is bound to its own folder via Obsidian view state:

- `setState({ folderPath }, result)` stores the path and re-renders; `getState()` returns `{ folderPath }`. Obsidian persists this with the workspace, so each tab reopens to its own folder.
- "Open as timeline" (folder right-click) and the ribbon/command both call `plugin.activateView(folderPath?)`, which opens a new tab via `leaf.setViewState({ type, state: { folderPath } })` and reveals it. The ribbon/command pass no path, so they fall back to `settings.defaultFolder`.
- The folder path flows into React through the provider (`useFolderPath()`), not a global — so multiple independent timelines can be open at once.

Because `setState` can fire before `onOpen()` creates the root, `renderApp()` guards on `this.root` and `onOpen()`'s own render covers the initial case.

## Settings flow

- `MicroblogSettings` + `DEFAULT_SETTINGS` live in `src/settings.ts`.
- Loaded in `onload()` via `Object.assign({}, DEFAULT_SETTINGS, await loadData())` (merge so new keys get defaults); saved via `saveData(settings)`.
- The settings object lives on `plugin.settings` and is read in React through `useSettings()`. (Settings changes don't yet trigger a React re-render — when that's needed, back `useSettings` with a subscription/version bump.)
- `MicroblogSettingTab` renders the settings UI with Obsidian's `Setting` builder.

## Data flow (the timeline)

Posts are plain notes; the plugin owns no database. The flow is one-directional with disk as the source of truth:

1. **`lib/posts.ts`** is the only place that touches the vault. It maps a file ↔ `Post` and does all CRUD, **scoped to the view's folder**:
   - read: `listPostFiles` (folder children, `.md` only) → `loadPost` reads frontmatter/tags from `metadataCache` and the body from `vault.cachedRead` (frontmatter stripped via the cached `frontmatterPosition`).
   - create: `createPost` makes the folder if needed and writes a timestamp-named file (`2026-06-09T143203.md`, collisions get a `-N` suffix) with `score: 0` frontmatter.
   - score: `adjustScore` via `fileManager.processFrontMatter` (atomic).
   - delete: `deletePost` via `fileManager.trashFile` (respects the user's trash setting).
   - edit: `openPost` opens the real note in a tab — editing happens in Obsidian's own editor, not in the plugin.
2. **`hooks/usePosts.ts`** loads the folder into React state and subscribes (inside `workspace.onLayoutReady`, removed via `offref` on unmount) to `vault` `create`/`delete`/`rename` + `metadataCache` `changed`, all filtered to the folder. Any change → reload. So hand-edits, deletes, and the plugin's own writes all converge through the same path: **write to disk → event fires → reload → re-render.** The UI never optimistically mutates local state.
3. **`Timeline.tsx`** filters (search over body + tags) and sorts (newest / top-by-score) in a `useMemo`, renders `PostCard`s bottom-anchored (newest just above the composer, auto-scroll to bottom), and calls `createPost` from the composer.
4. **`MarkdownPreview`** renders each post body the way Obsidian renders notes (see below).

## Markdown rendering

`components/MarkdownPreview.tsx` renders a body via `MarkdownRenderer.render(app, md, el, sourcePath, component)` in an effect. Correctness: a per-render child `Component` is `load()`ed and `unload()`ed on cleanup (so embeds/post-processors unregister), `sourcePath` is the post's own path (so relative links/embeds/`[[wikilinks]]` resolve), and the container is `empty()`d before each render. This is the *output* side; the composer's *input* is a plain textarea (no live-preview editor — only undocumented internal APIs exist for that, and we don't need them since Edit opens the real note).

## Icons — two systems, one rule

- **Inside the React tree:** FontAwesome (`@fortawesome/react-fontawesome` + the svg-core/solid/regular/brands packs). Import icons explicitly (e.g. `faComments`) so the bundle tree-shakes.
- **At the Obsidian boundary** (ribbon, `getIcon()`, menu `setIcon`): Obsidian's built-in **Lucide** icon *names* only (e.g. `"message-square"`). FontAwesome does not work there.

## Styling

Plain CSS in a single hand-written `styles.css` at the plugin root — Obsidian loads it directly (esbuild does **not** touch it; it only bundles `main.js`). Conventions:

- **Everything scoped under `.microblog-root`** (added to `contentEl`) so nothing leaks into Obsidian.
- **Themed with Obsidian's CSS variables** (`--background-primary`, `--text-normal`, `--interactive-accent`, `--radius-m`, `--size-4-*`, `--h2-size`, …) so the plugin matches the user's theme for free. Don't hardcode colors.
- `src/lib/utils.ts` exports `cn()` (plain `clsx`) for conditional class names — no `tailwind-merge`, since these are real CSS classes, not utilities.

## Build & tooling

- **Bundler: esbuild** (`esbuild.config.mjs`). Entry `src/main.ts` → `main.js` (CJS, ES2021). `obsidian`, CodeMirror (`@codemirror/*`), Lezer (`@lezer/*`), `electron`, and Node built-ins are `external` (Obsidian provides them); **React is bundled in**. JSX uses the automatic runtime (`jsx: "automatic"` / `tsconfig` `"jsx": "react-jsx"`).
- **Scripts:** `npm run dev` (esbuild watch), `npm run build` (`tsc -noEmit` then a one-off prod bundle), `npm run lint` (ESLint), `npm version` (bumps manifest/versions via `version-bump.mjs`).
  - **Don't run `npm run dev` yourself** — it's a long-running watch that conflicts with the user's. Use `npm run build` to verify.
- **Lint:** `eslint-plugin-obsidianmd`'s recommended flat config + type-aware typescript-eslint rules (the config block enables `projectService` so the type-aware rules have program info). This mechanically enforces Obsidian-API correctness (lifecycle/cleanup, `instanceof` over casting, supported-API checks against `minAppVersion`, etc.).
- **Hot reload:** the `.hotreload` marker + the Hot-Reload community plugin reload the plugin when `main.js`/`styles.css` change. If a change isn't caught, reload manually (Cmd+R or toggle the plugin).
- **`minAppVersion` 1.7.2** (required by `workspace.revealLeaf`). `isDesktopOnly: false` — the timeline/data layer work on mobile; only future cross-posting is desktop-only and will degrade gracefully.

## File map

```
manifest.json          id/name/version/minAppVersion/isDesktopOnly
versions.json          version → minAppVersion compatibility map
package.json           deps + scripts
tsconfig.json          strict, jsx: react-jsx
esbuild.config.mjs     bundles src/main.ts → main.js
eslint.config.mjs      obsidianmd recommended + type-aware TS rules
version-bump.mjs       npm-version hook: sync manifest/versions
.hotreload             marker for the Hot-Reload plugin
styles.css             hand-written, committed; scoped under .microblog-root
src/
  main.ts              MicroblogPlugin: settings, view registration, ribbon, command, folder menu
  settings.ts          MicroblogSettings + DEFAULT_SETTINGS + MicroblogSettingTab
  view.tsx             TimelineView (ItemView): mounts/unmounts the React root, holds folderPath
  app.tsx              <App> — the SPA root (renders <Timeline />)
  context/
    PluginContext.tsx  PluginProvider + useApp/usePlugin/useSettings/useFolderPath
  hooks/
    usePosts.ts        reads the folder + subscribes to vault/metadataCache events → React state
  components/
    Timeline.tsx       the screen: search/sort bar → feed → composer; filter/sort/scroll
    SearchSortBar.tsx  text search (+ clear) and sort order
    PostCard.tsx       one post: header/actions, folded markdown body, clickable tags
    Composer.tsx       textarea + char-count ring + NOTE button
    CharCountRing.tsx  circular char-count indicator
    MarkdownPreview.tsx renders a post body via MarkdownRenderer.render
  lib/
    posts.ts           data layer: file ↔ Post CRUD over vault/metadataCache/fileManager
    utils.ts           cn() (clsx), formatPostDate()
  types/
    index.ts           Post, SortOrder
```

## What's built vs. next

**Built:** the integration shell (plugin, state-bearing multi-instance view, context provider + hooks, settings + tab, scoped themed CSS, build/lint pipeline) **and the MVP timeline** — data layer, reactivity bridge, markdown rendering, and the full UI (search/sort, post cards with score/edit/delete/share, read-more fold, clickable tags, composer with char-count ring).

**Next:** cross-posting to Bluesky/Mastodon (the Share button is a placeholder Notice today) and threading/replies (`reply_to` is already in the `Post` type). See `spec.md` for both.
