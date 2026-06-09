import { TAbstractFile, TFile } from "obsidian";
import { useEffect, useState } from "react";
import { useApp } from "../context/PluginContext";
import { loadPosts } from "../lib/posts";
import type { Post } from "../types";

/**
 * Reactivity bridge: reads the folder's posts into React state and keeps them in
 * sync with disk. Subscribes to vault + metadataCache events (scoped to this folder)
 * so the timeline updates on hand-edits, deletes, and our own writes.
 *
 * Subscriptions are set up inside `workspace.onLayoutReady` (Obsidian's load-time
 * guidance — otherwise `create` fires once per file during startup) and every
 * listener is removed via `offref` on cleanup, so nothing leaks across mounts.
 */
export function usePosts(folderPath: string | undefined): Post[] {
	const app = useApp();
	const [posts, setPosts] = useState<Post[]>([]);

	useEffect(() => {
		if (!folderPath) {
			setPosts([]);
			return;
		}

		let cancelled = false;
		// Monotonic token so out-of-order reloads can't clobber a newer result: rapid
		// events (e.g. create + changed) each start a reload, and they may resolve out
		// of order — only the latest-started one is allowed to apply.
		let generation = 0;
		const cleanups: Array<() => void> = [];
		const prefix = folderPath.replace(/\/+$/, "") + "/";
		const inFolder = (file: TAbstractFile): boolean =>
			file instanceof TFile && file.path.startsWith(prefix);

		const reload = async () => {
			const mine = ++generation;
			const next = await loadPosts(app, folderPath);
			if (!cancelled && mine === generation) setPosts(next);
		};

		app.workspace.onLayoutReady(() => {
			if (cancelled) return;
			void reload();

			// File-set changes.
			const createRef = app.vault.on("create", (f) => {
				if (inFolder(f)) void reload();
			});
			const deleteRef = app.vault.on("delete", (f) => {
				if (inFolder(f)) void reload();
			});
			const renameRef = app.vault.on("rename", (f, oldPath) => {
				if (inFolder(f) || oldPath.startsWith(prefix)) void reload();
			});
			// Content/frontmatter changes — `changed` fires after the cache is updated
			// (unlike `modify`), so we read fresh metadata.
			const changedRef = app.metadataCache.on("changed", (f) => {
				if (inFolder(f)) void reload();
			});

			cleanups.push(
				() => app.vault.offref(createRef),
				() => app.vault.offref(deleteRef),
				() => app.vault.offref(renameRef),
				() => app.metadataCache.offref(changedRef),
			);
		});

		return () => {
			cancelled = true;
			cleanups.forEach((fn) => fn());
		};
	}, [app, folderPath]);

	return posts;
}
