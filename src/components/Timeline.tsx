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
		return [...filtered].sort((a, b) =>
			sort === "score" ? a.score - b.score || a.created - b.created : a.created - b.created,
		);
	}, [posts, search, sort]);

	// Bottom-anchored: jump to the newest post whenever the visible set changes.
	useEffect(() => {
		const el = feedRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [visible.length]);

	const addPost = async (body: string) => {
		await createPost(app, folderPath, body);
	};

	return (
		<div className="microblog-timeline">
			<SearchSortBar search={search} onSearch={setSearch} sort={sort} onSort={setSort} />

			<div className="microblog-feed" ref={feedRef}>
				{visible.length === 0 ? (
					<p className="microblog-empty">
						{search
							? "No posts match your search."
							: "No posts yet — write your first one below."}
					</p>
				) : (
					visible.map((p) => (
						<PostCard key={p.path} post={p} onSelectTag={setSearch} />
					))
				)}
			</div>

			<Composer onSubmit={addPost} />
		</div>
	);
}
