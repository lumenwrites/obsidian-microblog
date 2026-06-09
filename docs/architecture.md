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
  app.tsx              <App> — the SPA root (smoke screen for now)
  context/
    PluginContext.tsx  PluginProvider + useApp/usePlugin/useSettings/useFolderPath
  lib/
    utils.ts           cn() (clsx)
  types/
    index.ts           Post, SortOrder (shapes for the upcoming data layer)
```

## What's built vs. next

**Built (this scaffold):** the full integration shell end-to-end — plugin, state-bearing multi-instance view, context provider + hooks, settings + tab, FontAwesome, scoped themed CSS, build/lint pipeline. `<App>` is a smoke screen proving the chain (vault name + folder + a setting render with live theme colors).

**Next (the timeline feature, see `plan-timeline.md`):** the data layer (`lib/posts.ts`), the reactivity bridge (`hooks/usePosts.ts`), markdown rendering (`components/MarkdownPreview.tsx`), and the actual UI (search/sort bar → post list → composer).
