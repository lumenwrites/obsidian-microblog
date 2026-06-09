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
- The settings object lives on `plugin.settings` and is read in React through `useSettings()`. **Settings are reactive:** `saveSettings()` notifies subscribers (`plugin.onSettingsChange`), and `PluginProvider` subscribes and bumps state, so open views re-render live when a setting changes (e.g. toggling *Composer at top*).
- `MicroblogSettingTab` renders the settings UI with Obsidian's `Setting` builder. Current settings: `defaultFolder`, `charLimit` (read-more fold), `composerOnTop` (composer above the bar + newest/top-first ordering), `showStats` (stats widget), `dailyGoal` (target posts/day).

## Data flow (the timeline)

Posts are plain notes; the plugin owns no database. The flow is one-directional with disk as the source of truth:

1. **`lib/posts.ts`** is the only place that touches the vault. It maps a file ↔ `Post` and does all CRUD, **scoped to the view's folder**:
   - read: `listPostFiles` (folder children, `.md` only) → `loadPost` reads frontmatter/tags from `metadataCache` and the body from `vault.cachedRead` (frontmatter stripped via the cached `frontmatterPosition`).
   - create: `createPost` makes the folder if needed and writes a timestamp-named file (`2026-06-09T143203.md`, collisions get a `-N` suffix) with `score: 0` frontmatter, plus a quoted `reply_to` when it's a reply.
   - score: `adjustScore` via `fileManager.processFrontMatter` (atomic).
   - delete: `deletePost` via `fileManager.trashFile` (respects the user's trash setting).
   - archive: `archivePost` `renameFile`s the note into an `archived/` subfolder beside it. Since `listPostFiles` reads only *direct* children, archived posts drop out of the timeline (and stats) but stay in the vault, and the `archived/` folder can be opened as its own timeline.
   - edit: `openPost` opens the real note in a tab — editing happens in Obsidian's own editor, not in the plugin.
2. **`hooks/usePosts.ts`** loads the folder into React state and subscribes (inside `workspace.onLayoutReady`, removed via `offref` on unmount) to `vault` `create`/`delete`/`rename` + `metadataCache` `changed`, all filtered to the folder. Any change → reload. So hand-edits, deletes, and the plugin's own writes all converge through the same path: **write to disk → event fires → reload → re-render.** The UI never optimistically mutates local state.
3. **`Timeline.tsx`** turns the flat post list into display `rows` in a `useMemo`. With no search it builds the **reply tree** (`reply_to` → parent via each post's `id` = filename stem), sorts roots by the current order, sorts replies oldest→newest, and DFS-flattens to `{ post, depth }[]`; an active search instead flattens to the matching posts. It renders `PostCard`s bottom-anchored (auto-scroll to the composer edge), tracks the `replyTarget`, and calls `createPost(folder, body, replyTarget?.id)`.
4. **`MarkdownPreview`** renders each post body the way Obsidian renders notes (see below).

### Threads / replies

Each post's `id` is its filename stem; a reply stores the parent id in `reply_to` frontmatter (quoted so YAML can't coerce the timestamp-like id to a date). Threads are a pure transform over the already-live post list — no new events or subscriptions. `PostCard` indents by `min(depth, 5)` and draws a thread-line; the **Reply** action sets the composer's target (a "Replying to …" banner with cancel + autofocus). A reply whose parent isn't in the folder (renamed/deleted) renders as a root — no cascade on delete.

### Stats / streak

`lib/stats.ts` is pure math over the already-loaded posts (no I/O), so the widget is just another transform that stays live with the feed. Days are local (midnight boundary). A single carry pass (`dayStats`) resolves every day: walking from today backward, surplus posts beyond the goal flow into a "pool" that repairs earlier unmet days, but only within the last `BACKFILL_DAYS` (14) — bounding how much one big day can fabricate. Both outputs read from that one pass, so they're consistent: the **graph** square fill is each day's backfilled `ratio` (`min(available/goal, 1)` → accent opacity; a backfilled day shows filled and its tooltip says so), and the **streak** counts consecutive `satisfied` days. Today gets a grace day (an unmet but in-progress today counts the streak from yesterday). Replies count toward both goal and total.

## Markdown rendering

`components/MarkdownPreview.tsx` renders a body via `MarkdownRenderer.render(app, md, el, sourcePath, component)` in an effect. Correctness: a per-render child `Component` is `load()`ed and `unload()`ed on cleanup (so embeds/post-processors unregister), `sourcePath` is the post's own path (so relative links/embeds/`[[wikilinks]]` resolve), and the container is `empty()`d before each render. Tags render once — inline, by Obsidian — and a capture-phase click listener on `a.tag` intercepts them (before Obsidian's global-search handler) to drive *our* search instead. This is the *output* side; the composer's *input* is a plain textarea (no live-preview editor — only undocumented internal APIs exist for that, and we don't need them since Edit opens the real note).

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

## Distribution & releases

The plugin isn't in the community store; it's distributed to mobile (the user's iPad) via **BRAT**, which installs/auto-updates a plugin from a **public GitHub repo's latest release**. Mobile Obsidian can't compile, so a release must ship the *built* files: `main.js`, `manifest.json`, `styles.css`.

- **CI: `.github/workflows/release.yml`** fires on **every push to `main`**. It reads the version **from `manifest.json`** (via `jq`), and if no release with that version exists yet, runs `npm ci` + `npm run build` and creates a GitHub release tagged with that version, attaching the three assets. Because the tag is *derived from the manifest*, it can never drift from it — that drift (a release tagged `0.0.1` while the manifest says `0.1.0`) is what makes BRAT report `main.js` as "missing." Pushes that don't bump the version find the release already exists and **skip cleanly** (no failed runs).
- **Tags have no `v` prefix** and are created by the action, not by hand — Obsidian/BRAT require the tag to equal the manifest version exactly (`0.1.1`). Don't create release tags manually.
- **Cutting a release:** bump the version, commit, push to `main`:
  ```
  npm run build && npm run lint              # verify it compiles & lints
  npm version patch --no-git-tag-version     # bumps package.json + manifest.json + versions.json (no tag, no commit)
  git commit -am "Release 0.1.1"
  git push                                    # the action builds & publishes the release
  ```
  `npm version` runs the `version` script (`version-bump.mjs`), which syncs `manifest.json` + `versions.json` to the new number; `--no-git-tag-version` keeps tagging the action's job. `patch`/`minor`/`major` pick the bump.
- **Public-repo hygiene:** the repo is public. `main.js` (rebuilt by CI), `node_modules`, and `data.json` (runtime settings, may hold user paths) stay gitignored. Never commit vault notes, secrets, or anything outside this plugin folder.

## File map

```
manifest.json          id/name/version/minAppVersion/isDesktopOnly
versions.json          version → minAppVersion compatibility map
package.json           deps + scripts
tsconfig.json          strict, jsx: react-jsx
esbuild.config.mjs     bundles src/main.ts → main.js
eslint.config.mjs      obsidianmd recommended + type-aware TS rules
version-bump.mjs       npm-version hook: sync manifest/versions
.github/workflows/
  release.yml          on push to main: build + publish a release (assets for BRAT) when manifest version is new
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
    SearchSortBar.tsx  text search (+ clear) and sort control
    SortControl.tsx    dropdown trigger → Obsidian Menu with icon'd sort options
    PostCard.tsx       one post: folded markdown body + bottom-right footer (date/score/vote/edit + ⋯ menu)
    Composer.tsx       textarea + char-count ring + NOTE button
    CharCountRing.tsx  circular char-count indicator
    MarkdownPreview.tsx renders a post body via MarkdownRenderer.render; intercepts #tag clicks
    StatsWidget.tsx    contribution graph + backfilled streak + total (under the composer)
  lib/
    posts.ts           data layer: file ↔ Post CRUD over vault/metadataCache/fileManager
    confirm.ts         promise-based confirmation Modal (used by delete)
    stats.ts           pure stats math: one carry pass → backfilled 30-day graph + streak
    utils.ts           cn() (clsx), formatPostDate()
  types/
    index.ts           Post, SortOrder
```

## What's built vs. next

**Built:** the integration shell (plugin, state-bearing multi-instance view, context provider + hooks, settings + tab, scoped themed CSS, build/lint pipeline) **and the MVP timeline** — data layer, reactivity bridge, markdown rendering, and the full UI (search/sort, post cards with score/edit/delete/share, read-more fold, clickable tags, composer with char-count ring).

**Next:** cross-posting to Bluesky/Mastodon (the Share button is a placeholder Notice today) and threading/replies (`reply_to` is already in the `Post` type). See `spec.md` for both.
