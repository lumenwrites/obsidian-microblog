# Plan: Scaffold the Obsidian + React starter

Goal: stand up an Obsidian plugin that hosts a **single-page React app** inside an `ItemView`, with a clean separation between the thin Obsidian integration layer and the React SPA. After this plan is done, building a feature should feel like writing a normal React app, with Obsidian's `App`/`Vault`/`Workspace` reachable through a context hook.

This doc tracks the scaffold. Once everything in `## DONE` is built and reflected in `architecture.md` + `best-practices.md`, delete this file (see Plan lifecycle in CLAUDE.md).

---

## Key decisions

### Tech stack
- **Bundler: esbuild** — the Obsidian standard. Entry `src/main.ts` → `main.js` (CommonJS, ES2021). `obsidian`, CodeMirror (`@codemirror/*`), Lezer (`@lezer/*`), and Node built-ins are marked `external` (Obsidian provides them); everything else — including React — is bundled in.
- **React 19 + react-dom/client** — mounted with `createRoot()` inside the view, unmounted in `onClose()`.
- **FontAwesome for in-app icons** — `@fortawesome/react-fontawesome` + `@fortawesome/fontawesome-svg-core` + the solid/regular/brands packs (same setup as starter-vite). Used for all icons *inside* the React app (edit/delete/upvote/share/search). **Caveat:** Obsidian's own native UI — the ribbon icon, `setIcon()` calls, menu items — must use Obsidian's built-in Lucide icon names, not FontAwesome. So: FontAwesome inside the React tree, Lucide names at the Obsidian boundary.
- **TypeScript**, `"jsx": "react-jsx"`, strict mode on.
- **ESLint** via **`eslint-plugin-obsidianmd`** (v0.3.0+) + TS rules. This is the mechanical enforcement of the Obsidian-API correctness layer — lifecycle/cleanup, `instanceof` over casting, no `detachLeavesOfType` in `onunload`, etc. (We deliberately do *not* install a separate plugin-dev agent skill; the lint rules + Context7 docs cover that ground, and our own `docs/best-practices.md` owns the structural conventions.)

### The Obsidian↔React boundary (the core pattern)
1. `Plugin` subclass (`src/main.ts`) is the long-lived host. It owns settings (persisted via `loadData`/`saveData`), registers the view type, the ribbon icon, commands, and the settings tab. **State that must outlive React mounts lives on the plugin instance, not in React** — React components mount/unmount every time the view opens/closes.
2. An `ItemView` subclass (`src/view.tsx`) is the bridge: `onOpen()` creates the React root on `this.contentEl` and renders `<App>` wrapped in a single context provider; `onClose()` calls `root.unmount()`.
3. **One context provider** (`src/context/PluginContext.tsx`) exposes the `App`, the `Plugin` instance, and live settings to the entire tree. Components reach them via `useApp()` / `usePlugin()` / `useSettings()` hooks instead of prop-drilling. This is the official Obsidian recommendation, generalized to also carry the plugin + settings.

### In-app navigation
There is no browser URL inside Obsidian, so **don't use React Router's `BrowserRouter`**. Start with simple state-based view switching (a `useState` "current screen" in `<App>`); if routing grows complex, switch to React Router's **`MemoryRouter`**. Decide per-feature, not now.

### Styling — plain CSS (decided: no Tailwind)
We deliberately skip Tailwind. For an Obsidian plugin it's more friction than value: Obsidian already supplies the design-token system via CSS variables, and Tailwind v4 fights Obsidian (global preflight resets, prefix/scope dance, utilities silently losing to Obsidian's own styles). Plain CSS is cleaner here.
- **Hand-write `styles.css` at the plugin root.** Obsidian loads it automatically — no build step, esbuild only emits `main.js`. `styles.css` is committed source, not generated.
- **Scope everything under `.microblog-root`** (the class we add to the view's `contentEl`) so nothing leaks into the rest of Obsidian.
- **Theme with Obsidian's CSS variables** (`var(--background-primary)`, `var(--text-normal)`, `var(--interactive-accent)`, `var(--radius-m)`, `var(--size-4-2)`, …) so the plugin matches the user's theme (light/dark/custom) for free. Use semantic class names that consume these variables.
- Use modern CSS (nesting, custom properties) for ergonomics. If `styles.css` ever grows unwieldy we can split files and let esbuild concatenate — not needed at this size.
- If we ever genuinely miss utility classes, Tailwind is addable later; don't pre-optimize for it.

### Dev workflow
- This plugin folder **is** the install location inside the vault. `npm run dev` (esbuild watch) rebuilds `main.js` on save.
- Install the **Hot-Reload plugin** (`pjeby/hot-reload`) in this vault and add an empty `.hotreload` marker file here so it auto-reloads on rebuild. Otherwise reload manually (Cmd+R or toggle the plugin off/on).
- **Decided: develop in the primary vault** (this location) for convenience. Accepted risk: a buggy `Vault` mutation could touch real notes — so be careful with `vault.create`/`modify`/`delete` paths, always scope operations to the timeline folder, and lean on the vault's own backup/sync. If it ever bites, revisit a throwaway/symlinked dev vault.

### Shaped for the microblog spec (beyond the generic scaffold)

The spec (`docs/spec.md`) adds five concrete requirements the scaffold must accommodate. All APIs below are confirmed against the Obsidian docs:

1. **State-bearing, multi-instance view.** Each timeline tab holds its own `folderPath` via the view's `getState()`/`setState()`; "Open as Timeline" calls `leaf.setViewState({ type, state: { folderPath } })`. So the view is *not* a singleton — multiple can be open at once, each independent. The React tree reads its folder from view state (passed through the provider), not from a global.
2. **"Open as Timeline" folder menu.** Register `workspace.on('file-menu', …)` (via `registerEvent`), and only add the item when `file instanceof TFolder`.
3. **Data layer module** (`src/lib/posts.ts`) — maps file ↔ `Post`, no custom parser needed: `vault.create` (new post with frontmatter), `metadataCache.getFileCache(file).frontmatter`/`.tags` (read score/shared/tags), `fileManager.processFrontMatter` (atomic score/shared writes), `vault.process`/`modify` (body edits), `vault.delete`. Filenames encode the timestamp (`2026-06-09T143203.md`) for sort order.
4. **Reactivity bridge** (`src/hooks/usePosts.ts`) — the timeline must update when files change on disk (hand-edits, deletes, the user's own writes). Subscribe to `vault.on('create'|'modify'|'delete'|'rename')` + `metadataCache.on('changed')`, **registered inside `workspace.onLayoutReady`** (per Obsidian's load-time guidance — `create` fires for every file during startup otherwise), filtered to the view's folder, and push results into React state.
5. **Markdown rendering** (`src/components/MarkdownPreview.tsx`) — render post bodies the way Obsidian renders notes via `MarkdownRenderer.render(app, markdown, el, sourcePath, component)` into a ref'd `<div>`. Three details for correctness: (a) create a **per-post child `Component`** in the effect and `unload()` it on cleanup, so embeds/links/post-processors register *and* unregister; (b) pass **`sourcePath` = the post's file path** so relative links, embeds, and `[[wikilinks]]` resolve correctly (each post is a real note); (c) **`el.empty()` before re-rendering** on edit/score change so DOM doesn't stack. This is the *output* side and is easy — distinct from the bottom editor's live-preview *input*, which remains the deferred spike (see the editor decision in TODO).

**Editor — decided: keep it simple.** The composer is a plain auto-growing textarea via [`react-textarea-autosize`](https://www.npmjs.com/package/react-textarea-autosize). No inline live-preview editor. Rationale: there's no public API to embed Obsidian's real Live Preview editor — only undocumented internal hacks (`EmbeddableMarkdownEditor`) that break across versions and flag in plugin review. We don't need them: post bodies render via `MarkdownRenderer` (above), and since every post is a real note, the **Edit** action can just open the post's actual file in a normal Obsidian editor (tab/split/popover) for the 100%-real editing experience. So the textarea only ever composes *new* short posts — perfectly adequate. (If the composer itself ever needs live-preview-while-typing, the internal `EmbeddableMarkdownEditor` helper is a contained post-MVP spike with the textarea as fallback — not planned.)

---

## Target file structure

```
microblog/
  CLAUDE.md                  ✓ done
  manifest.json              id/name/version/minAppVersion/isDesktopOnly
  versions.json              { version: minAppVersion } map for compatibility
  package.json               deps + scripts (dev/build/lint/version)
  tsconfig.json              strict, jsx: react-jsx
  esbuild.config.mjs         bundle src/main.ts → main.js
  eslint.config.mjs          TS + obsidian plugin rules
  .gitignore                 node_modules, main.js (build output)
  .editorconfig
  .hotreload                 empty marker for the Hot-Reload plugin
  styles.css                 hand-written, committed — Obsidian loads it (scoped under .microblog-root)
  docs/
    spec.md                  what it does / planned
    architecture.md          the integration, file map, state/settings flow
    best-practices.md        coding conventions + Obsidian gotchas
    plan-setup.md            this file (delete when done)
  src/
    main.ts                  Plugin subclass: settings, view registration, commands, ribbon, settings tab
    settings.ts              Settings type + DEFAULT_SETTINGS + SampleSettingTab
    view.tsx                 ItemView subclass: mounts/unmounts the React root
    app.tsx                  <App> — the SPA root (search bar + timeline + editor)
    context/
      PluginContext.tsx      provider + useApp / usePlugin / useSettings / useFolderPath hooks
    components/
      MarkdownPreview.tsx    renders post body via MarkdownRenderer.render into a ref'd div
      ...                    timeline/post/editor components (organized by feature)
    hooks/
      usePosts.ts            reads the folder + subscribes to vault/metadataCache events → React state
    lib/
      posts.ts               data layer: file ↔ Post CRUD over vault/metadataCache/fileManager
      utils.ts               cn() (clsx) and small helpers
    types/
      index.ts               shared TS types (Post, frontmatter shape, sort/filter)
```
Styling lives in a single hand-written `styles.css` at the plugin root (not under `src/`) — Obsidian loads it directly.

---

## Reference snippets (the load-bearing patterns)

**View mounts the SPA + provides context (`src/view.tsx`):**
```tsx
async onOpen() {
  this.contentEl.addClass('microblog-root');           // scope styles here
  this.root = createRoot(this.contentEl);
  this.root.render(
    <StrictMode>
      <PluginProvider plugin={this.plugin}>
        <App />
      </PluginProvider>
    </StrictMode>,
  );
}
async onClose() {
  this.root?.unmount();                                 // critical: no leaks
}
```

**One provider, three hooks (`src/context/PluginContext.tsx`):**
```tsx
const PluginContext = createContext<MicroblogPlugin | undefined>(undefined);
export const PluginProvider = ({ plugin, children }) =>
  <PluginContext value={plugin}>{children}</PluginContext>;
export const usePlugin   = () => useNonNull(useContext(PluginContext));
export const useApp      = () => usePlugin().app;
export const useSettings = () => usePlugin().settings;   // back this with a re-render on change later
```

**Settings outlive React, persisted via the plugin (`src/main.ts`):**
```ts
this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
// ...mutate, then:
await this.saveData(this.settings);
```

---

## TODO

- [ ] `package.json` — React 19, react-dom, obsidian, typescript, esbuild, eslint, **eslint-plugin-obsidianmd**, FontAwesome (`@fortawesome/*`), clsx, `react-textarea-autosize`. Scripts: `dev`, `build` (`tsc -noEmit && esbuild prod`), `lint`, `version`.
- [ ] `manifest.json` + `versions.json` — id `microblog`, sensible `minAppVersion`, `isDesktopOnly: false` (the timeline + data layer work on mobile; only cross-posting is desktop-only and degrades gracefully).
- [ ] `tsconfig.json` (strict, `jsx: react-jsx`) + `esbuild.config.mjs` (externals, watch/prod modes; emits `main.js` only — CSS is hand-written).
- [ ] `eslint.config.mjs` — wire in `eslint-plugin-obsidianmd`'s recommended config + TS rules. `.gitignore` (ignore `main.js`, `node_modules`; `styles.css` is committed source), `.editorconfig`, `.hotreload`.
- [ ] `src/main.ts` — Plugin subclass: load/save settings, register view type, ribbon icon + command to open/reveal the view, settings tab.
- [ ] `src/settings.ts` — `Settings` type, `DEFAULT_SETTINGS`, `SettingTab` with one sample setting.
- [ ] `src/view.tsx` — `ItemView` mounting/unmounting the React root with the provider.
- [ ] `src/context/PluginContext.tsx` — provider + `useApp` / `usePlugin` / `useSettings`.
- [ ] `src/app.tsx` — minimal SPA: a header + one screen that reads `useApp().vault.getName()` and a setting, proving the whole chain works end-to-end.
- [ ] `src/lib/utils.ts` (`cn()` via clsx), `src/types/index.ts`, root `styles.css` (scoped under `.microblog-root`, Obsidian variables).
- [ ] Verify: `npm run build` produces `main.js`, `npm run lint` clean, the view opens in Obsidian and renders the React app with live theme colors.
- [ ] Write `docs/spec.md`, `docs/architecture.md`, `docs/best-practices.md` from what was actually built.
- [ ] Delete this plan once the above are reflected in spec + architecture.

## DONE

- [x] `CLAUDE.md` — router + conventions, adapted from the starter-vite conventions for an Obsidian plugin.
- [x] Online research on the Obsidian + React SPA pattern (official docs: createRoot in `ItemView`, `AppContext` + `useApp`, cleanup; esbuild externals; settings persistence; Hot-Reload workflow).
