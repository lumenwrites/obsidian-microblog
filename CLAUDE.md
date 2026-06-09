# Project

[Brief description of what this plugin does and who it's for.]

This is an **Obsidian plugin** built as a **single-page React app**. The plugin registers an Obsidian `ItemView` (and/or `Modal`) and mounts a full React application inside it — so most feature work is ordinary React/TypeScript, with a thin Obsidian integration layer at the edges.

The plugin folder lives **inside the vault** at `.obsidian/plugins/microblog/` — this is the real install location, so a rebuild updates the running plugin directly (with the Hot-Reload plugin enabled, it reloads automatically).

Read `docs/spec.md` for what we're building and what's implemented.


# Docs

- `docs/spec.md` — What the plugin does (implemented) and what's planned. **Source of truth for the product.**
- `docs/architecture.md` — How it's built: the Obsidian↔React integration (view mounting, context, settings, build). **Read when working on the plugin.**
- `docs/best-practices.md` — Coding conventions, component patterns, Obsidian API gotchas. **Always read before writing code.**
- `docs/plan-timeline.md` — Plan for the timeline feature (data layer, reactivity, UI) built on the scaffold.


# Documentation

Docs should be self-improving and self-maintaining — update them proactively when learning or changing something important. Our collection of docs is the main system that makes you smarter and more capable of working effectively with the user. We should proactively look for opportunities to improve, update, and streamline this system.

## What goes where

- **CLAUDE.md** (this file) — High-level overview and router. Tells you what the project is and which docs to read. Keep it short.
- **`docs/`** — All the detail: spec, architecture, best practices, plans. Update them as the project evolves.

## Doc types and naming

Every doc file uses a prefix that describes what kind of document it is:

- `spec` — What the plugin does (implemented features) and what's planned. Single source of truth for the product.
- `architecture` — How it's built. File structure, the Obsidian↔React boundary, data/state flow, key design decisions.
- `best-practices-` — How to write code. Coding conventions, patterns, standards. Read proactively before writing code.
- `plan-` — Feature implementation plans. Architectural decisions + TODO/DONE tracking. See "Plan lifecycle" below.
- `tasks-` — Task lists per feature. Goal summary at top, `## TODO` and `## DONE` sections. Move completed items from TODO to DONE (don't cross out or use checkboxes).
- `guide-` — How-to guides for the user for specific tasks.
- `reference-` — Technical lookup material.

## Plan lifecycle

Plans are the main way we track feature work, in `docs/plan-{feature}.md`.

**Creating a plan:** When starting a new feature, create `docs/plan-{feature}.md`. Start with key architectural decisions, then add `## TODO` and `## DONE` sections. As work progresses, move items from TODO to DONE.

**After implementation:** Once a plan is fully implemented, its content should already be reflected in `spec.md` (what it does) and `architecture.md` (how it works). Verify both are up to date, then delete the plan. No archival needed — git history has it.

## Proactive doc maintenance

- When working on the plugin, read the relevant docs before answering.
- Write descriptive comments in the code, so that me and you in future chats have a good understanding of what's going on.
- Create additional docs as the project grows.
- Proactively prompt the user to update/refactor docs when you see issues, inconsistencies, redundancies, etc. Proactively tell the user if you hit an inconvenient issue during your workflow, struggle with something, or notice anything that could be streamlined, documented better, or turned into scripts/templates.


# Conventions

- **Build, don't watch**: Don't start `npm run dev` (esbuild watch) yourself — it's a long-running process that interferes with the user's own watch instance. Use `npm run build` for a one-off compile + type-check to verify your changes. Ask the user to (re)start the watch build when needed.
- **Don't reload Obsidian for the user**: You can't reliably control the running app. If a change needs a reload and Hot-Reload isn't catching it, ask the user to reload (Cmd+R / disable-enable the plugin).
- **Type-check and lint after changes**: Run `npm run build` (includes `tsc`) and `npm run lint` after building features. Fix all errors and warnings.
- **Committing & releasing**: **Commit directly on `main`** — don't create feature branches (releases trigger on pushes to `main`, so branching defeats the flow). The repo is **public** on GitHub and the plugin ships to the user's iPad via **BRAT**. Pushing to `main` triggers `.github/workflows/release.yml`, which publishes a release **only when `manifest.json`'s version is new** (the tag is derived from the manifest, so it can't drift). Before committing: `npm run build` + `npm run lint` must pass, and **never commit vault data, secrets, or `data.json`** (public repo — `main.js`/`node_modules`/`data.json` stay gitignored, CI rebuilds `main.js`). To cut a release: `npm version <patch|minor|major> --no-git-tag-version`, commit, push — don't create tags by hand. Full details in `docs/architecture.md` → "Distribution & releases".
- **Stay inside the plugin folder**: This folder lives inside the user's real vault. Never touch other vault notes or `.obsidian/` config outside `plugins/microblog/`. Treat the surrounding vault as the user's private data.
- **Clean up Obsidian resources**: Always `unmount()` React roots in `onClose()`, and register listeners/intervals/events via `this.registerEvent` / `this.registerInterval` / `this.register` so Obsidian tears them down. Leaks here are a top cause of plugin bugs.
- **Respect the Obsidian API surface**: Prefer documented `App`/`Vault`/`Workspace`/`MetadataCache` APIs over reaching into internals or the filesystem directly. Mark `isDesktopOnly` honestly and avoid Node-only APIs unless desktop-only.
- **Surface blockers immediately**: When blocked by something the user can fix (plugin not enabled, Hot-Reload missing, a reload needed), tell them on the first failure. Don't retry silently or work around it.
- **Be proactive**: If you see an issue or have a good idea — tell me. If you notice something that could be streamlined, documented better, or turned into a script — say so.
- **Avoid polluting context**: Don't read large files if you can avoid it. Read targeted sections, use grep, check file sizes first.
- **No hacks**: No hacky fixes, workarounds, or shortcuts. Implement everything properly right away. Clever/concise solutions are good; ugly hacks that make code bug-prone are bad.
- **No memory system**: Don't use the `.claude/` memory directory. Put all persistent guidance in this file (CLAUDE.md) or in `docs/`.
- **No global Claude settings**: Don't write to global Claude config unless the user explicitly asks.
- Help me update `.gitignore` as needed so we don't accidentally track build output (`main.js`), `node_modules`, or vault files.
