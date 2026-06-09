import { useEffect, useMemo, useRef, useState } from "react";
import { useApp, useFolderPath, useSettings } from "../context/PluginContext";
import { usePosts } from "../hooks/usePosts";
import { createPost } from "../lib/posts";
import type { SortOrder } from "../types";
import { Composer } from "./Composer";
import { PostCard } from "./PostCard";
import { SearchSortBar } from "./SearchSortBar";

/**
 * The timeline screen: search/sort bar → scrolling feed → composer.
 *
 * Posts render in ascending order (oldest at top, newest/highest just above the
 * composer) and the feed auto-scrolls to the bottom when the set changes — a
 * chat-like, bottom-anchored feel.
 */
export function Timeline() {
	const app = useApp();
	const settings = useSettings();
	const folderPath = useFolderPath() ?? settings.defaultFolder;
	const posts = usePosts(folderPath);
	const composerOnTop = settings.composerOnTop;

	const [search, setSearch] = useState("");
	const [sort, setSort] = useState<SortOrder>("chronological");
	const feedRef = useRef<HTMLDivElement>(null);

	const visible = useMemo(() => {
		const q = search.trim().toLowerCase();
		const filtered = q
			? posts.filter(
					(p) =>
						p.body.toLowerCase().includes(q) ||
						p.tags.some((t) => t.toLowerCase().includes(q)),
				)
			: posts;
		// Composer-at-bottom: ascending (newest/top nearest the composer below).
		// Composer-at-top: descending (newest/top first, just under the composer above).
		const dir = composerOnTop ? -1 : 1;
		return [...filtered].sort(
			(a, b) =>
				dir *
				(sort === "score" ? a.score - b.score || a.created - b.created : a.created - b.created),
		);
	}, [posts, search, sort, composerOnTop]);

	// Anchor the feed to the composer's edge whenever the visible set changes.
	useEffect(() => {
		const el = feedRef.current;
		if (el) el.scrollTop = composerOnTop ? 0 : el.scrollHeight;
	}, [visible.length, composerOnTop]);

	const addPost = async (body: string) => {
		await createPost(app, folderPath, body);
	};

	const bar = <SearchSortBar search={search} onSearch={setSearch} sort={sort} onSort={setSort} />;
	const composer = <Composer onSubmit={addPost} atTop={composerOnTop} />;
	const feed = (
		<div className="microblog-feed" ref={feedRef}>
			{visible.length === 0 ? (
				<p className="microblog-empty">
					{search ? "No posts match your search." : "No posts yet — write your first one."}
				</p>
			) : (
				visible.map((p) => <PostCard key={p.path} post={p} onSelectTag={setSearch} />)
			)}
		</div>
	);

	return (
		<div className="microblog-timeline">
			{composerOnTop ? (
				<>
					{composer}
					{bar}
					{feed}
				</>
			) : (
				<>
					{bar}
					{feed}
					{composer}
				</>
			)}
		</div>
	);
}
