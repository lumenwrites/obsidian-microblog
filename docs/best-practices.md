# Best Practices

How to write code in this plugin. Read this before writing code. For the structure it describes, see `architecture.md`.

Most of this is mechanically enforced by `npm run lint` (`eslint-plugin-obsidianmd` + type-aware TS rules) — run it after every change and fix everything.

## Lifecycle & cleanup (the #1 source of plugin bugs)

- **Always `root.unmount()` in `onClose()`.** Every React root created in `onOpen()` must be torn down.
- **Register everything disposable through Obsidian** so it's cleaned up on unload: `this.registerEvent(...)`, `this.registerInterval(...)`, `this.registerDomEvent(...)`, `this.register(...)`. Never attach a bare `addEventListener`/`setInterval`.
- **Never `detachLeavesOfType` in `onunload()`** — Obsidian persists/restores leaves; tearing them down on unload breaks that (and the lint rule flags it).
- **Subscribe to vault/metadataCache events inside `workspace.onLayoutReady(...)`** when reading the vault at load time — otherwise `create` fires once for every file during startup.

## The Obsidian↔React boundary

- **State that must outlive a mount lives on the plugin instance, not React.** React unmounts whenever the tab closes. Persisted settings/state belong on `plugin` (via `loadData`/`saveData`).
- **Reach Obsidian through the context hooks** (`useApp`, `usePlugin`, `useSettings`, `useFolderPath`) — don't prop-drill `app`/`plugin`, and don't stash them in module globals.
- **The view owns Obsidian wiring; components stay pure React.** Anything touching `Vault`/`Workspace` should go through `lib/` functions or the view, not be scattered across components.

## Obsidian API hygiene

- **Prefer `instanceof` over casting** — `if (file instanceof TFolder)` / `instanceof TFile`, not `as TFolder`. The lint rule enforces this and it's also safer.
- **Prefer documented `App`/`Vault`/`Workspace`/`MetadataCache` APIs** over reaching into internals or the filesystem. If you think you need an internal/undocumented API, stop and flag it — there's usually a supported path.
- **Respect `minAppVersion`.** The lint rule errors if you use an API newer than `manifest.json`'s `minAppVersion`. Either use an older API or bump `minAppVersion` deliberately (and update `versions.json`).
- **Data layer uses Obsidian APIs, no custom parser:** `vault.create`, `metadataCache.getFileCache(file).frontmatter`/`.tags`, `fileManager.processFrontMatter` (atomic frontmatter writes), `vault.process`/`modify` (body), `vault.delete`.
- **Scope all vault mutations to the timeline folder.** We develop in the *primary* vault, so a stray `create`/`modify`/`delete` path could touch real notes. Always build paths under the view's `folderPath`; never operate on arbitrary vault paths.

## Icons

- **Inside React:** FontAwesome. Import each icon explicitly (`import { faTrash } from "@fortawesome/free-solid-svg-icons"`) so it tree-shakes; render `<FontAwesomeIcon icon={faTrash} />`.
- **At the Obsidian boundary** (ribbon, `getIcon()`, menu `setIcon`): Lucide icon *names* only. FontAwesome won't render there.

## Styling

- **Write CSS in `styles.css`, scoped under `.microblog-root`.** No inline styles for anything themable.
- **Use Obsidian CSS variables** for color/spacing/radius (`--text-normal`, `--background-secondary`, `--interactive-accent`, `--radius-m`, `--size-4-*`, …). Don't hardcode colors — it breaks theme support.
- Use `cn()` from `lib/utils.ts` for conditional class names.

## Error handling

- **Wrap fire-and-forget vault mutations in `run()`** (`lib/utils.ts`): `onClick={() => void run(() => adjustScore(app, file, 1), "Couldn't update score")}`. It catches, `console.error`s, and shows a `Notice` — never let a failed write be swallowed by a bare `void`.
- Where a component owns surrounding state (e.g. the composer's busy flag and text), use a local `try/catch/finally` instead, so you control what happens on failure (the composer keeps your text and resets `busy`).
- Don't add info-level `console.log` noise — it shows up in every user's console and the Obsidian review guidelines discourage it. Log on *failure* (`console.error`), not on every step.

## React conventions

- Components in `PascalCase.tsx`; one screen/feature per file, organized by feature under `src/components/`.
- Hooks in `src/hooks/`, named `useThing.ts`; pure helpers in `src/lib/`.
- `StrictMode` is on — effects run twice in dev. Write effects that are safe to run twice and always return a cleanup function.
- Keep components pure; push Obsidian/vault side effects into `lib/` functions and hooks.
- **Reuse the UI primitives.** In-view dropdowns use `Dropdown`; "pick one option" controls use `SelectControl` (see `SortControl`/`FilterControl` as presets) — don't hand-roll another popover or reach for Obsidian's `Menu` inside the React tree.
- **Guard against out-of-order async.** When overlapping async calls can write the same state (e.g. event-driven reloads), gate the result on a generation token so a slow earlier call can't clobber a newer one (see `usePosts`).

## TypeScript

- **Strict mode, no `any`.** The type-aware lint rules reject unsafe `any` assignments. `loadData()` returns `any` — cast it (`as Partial<MicroblogSettings> | null`) before merging.
- **No floating promises.** `await` them, or mark fire-and-forget calls with `void` (e.g. `void this.activateView()` in a sync callback).
- Prefer `import type` for type-only imports.

## Workflow

- **Build, don't watch:** use `npm run build` to verify; don't start `npm run dev` (it conflicts with the user's watch).
- **Run `npm run build` + `npm run lint` after every change** and fix all errors/warnings before considering work done.
- **Don't reload Obsidian for the user** — if a change needs a reload and Hot-Reload didn't catch it, ask them.
- **Stay inside the plugin folder.** Never touch other vault notes or `.obsidian/` config outside `plugins/microblog/`.
