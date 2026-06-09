import { getAllTags } from "obsidian";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp, useFolderPath, useSettings } from "../context/PluginContext";
import { usePosts } from "../hooks/usePosts";
import { createPost } from "../lib/posts";
import type { DoneFilter, Post, SortOrder } from "../types";
import { Composer } from "./Composer";
import { PostCard } from "./PostCard";
import { SearchSortBar } from "./SearchSortBar";
import { StatsWidget } from "./StatsWidget";

/** A post placed in display order, with its nesting depth in the thread tree. */
interface Row {
	post: Post;
	depth: number;
}

/**
 * The timeline screen: search/sort bar → scrolling feed → composer.
 *
 * Without a search, posts render as threads: `reply_to` links children to parents,
 * roots are sorted by the current order, and replies sit oldest→newest under their
 * parent. An active search flattens to the matching posts (threading a filtered
 * subset is meaningless). The feed is bottom-anchored (or top, per the layout
 * setting) like a chat.
 */
export function Timeline() {
	const app = useApp();
	const settings = useSettings();
	const folderPath = useFolderPath() ?? settings.defaultFolder;
	const posts = usePosts(folderPath);
	const composerOnTop = settings.composerOnTop;

	const [search, setSearch] = useState("");
	const [sort, setSort] = useState<SortOrder>("chronological");
	const [filter, setFilter] = useState<DoneFilter>("all");
	const [replyTarget, setReplyTarget] = useState<Post | null>(null);
	const feedRef = useRef<HTMLDivElement>(null);

	const query = search.trim().toLowerCase();
	// Composer-at-bottom: roots ascending (newest/top nearest the composer below).
	// Composer-at-top: descending (newest/top first, just under the composer above).
	const dir = composerOnTop ? -1 : 1;

	const rows = useMemo<Row[]>(() => {
		// Resurface review-priority: stale, high-scored posts rise; just-touched ones
		// (any edit/upvote/done bumps mtime) sink and slowly climb back. (score + 1) so
		// score-0 posts still resurface by age; downvoted posts sink below them.
		const now = Date.now();
		const resurfacePriority = (p: Post) =>
			(p.score + 1) * Math.max(0, (now - p.modified) / 86_400_000);

		const compareRoots = (a: Post, b: Post) => {
			if (sort === "resurface") return dir * (resurfacePriority(a) - resurfacePriority(b));
			if (sort === "score") return dir * (a.score - b.score || a.created - b.created);
			return dir * (a.created - b.created);
		};

		// Filter by done state first.
		const pool =
			filter === "all"
				? posts
				: posts.filter((p) => (filter === "done" ? p.done != null : p.done == null));

		// Search: a flat list of matching posts (replies included).
		if (query) {
			const matches = (p: Post) =>
				p.body.toLowerCase().includes(query) ||
				p.tags.some((t) => t.toLowerCase().includes(query));
			return pool
				.filter(matches)
				.sort(compareRoots)
				.map((post) => ({ post, depth: 0 }));
		}

		// Threaded: parent → children, plus the roots (top-level or orphaned replies).
		const byId = new Map(pool.map((p) => [p.id, p]));
		const childrenOf = new Map<string, Post[]>();
		const roots: Post[] = [];
		for (const p of pool) {
			if (p.replyTo && byId.has(p.replyTo)) {
				const siblings = childrenOf.get(p.replyTo);
				if (siblings) siblings.push(p);
				else childrenOf.set(p.replyTo, [p]);
			} else {
				roots.push(p);
			}
		}
		for (const siblings of childrenOf.values()) {
			siblings.sort((a, b) => a.created - b.created); // replies read oldest→newest
		}
		roots.sort(compareRoots);

		// DFS into a flat list in display order, carrying depth for indentation.
		const out: Row[] = [];
		const walk = (post: Post, depth: number) => {
			out.push({ post, depth });
			for (const child of childrenOf.get(post.id) ?? []) walk(child, depth + 1);
		};
		roots.forEach((root) => walk(root, 0));
		return out;
	}, [posts, query, sort, dir, filter]);

	// Anchor the feed to the composer's edge whenever the visible set changes.
	useEffect(() => {
		const el = feedRef.current;
		if (el) el.scrollTop = composerOnTop ? 0 : el.scrollHeight;
	}, [rows.length, composerOnTop]);

	// Distinct tags across the folder for composer autocomplete. Drawn from *all* tags
	// in the folder's posts (inline #hashtags + frontmatter), not just our structured
	// `post.tags`, so existing material seeds the suggestions even before any post uses
	// the new tags field.
	const allTags = useMemo(() => {
		const set = new Set<string>();
		for (const p of posts) {
			const cache = app.metadataCache.getFileCache(p.file);
			if (cache) for (const t of getAllTags(cache) ?? []) set.add(t.replace(/^#/, ""));
		}
		return [...set].sort((a, b) => a.localeCompare(b));
	}, [posts, app]);

	const addPost = async (body: string, tags: string[]) => {
		await createPost(app, folderPath, body, { tags, replyTo: replyTarget?.id });
		setReplyTarget(null);
	};

	const bar = (
		<SearchSortBar
			search={search}
			onSearch={setSearch}
			sort={sort}
			onSort={setSort}
			filter={filter}
			onFilter={setFilter}
		/>
	);
	const composer = (
		<Composer
			onSubmit={addPost}
			atTop={composerOnTop}
			replyingTo={replyTarget}
			onCancelReply={() => setReplyTarget(null)}
			allTags={allTags}
		/>
	);
	const stats = settings.showStats ? <StatsWidget posts={posts} /> : null;
	const feed = (
		<div className="microblog-feed" ref={feedRef}>
			{rows.length === 0 ? (
				<p className="microblog-empty">
					{query
							? "No posts match your search."
							: filter === "done"
								? "No posts marked done yet."
								: filter === "notdone"
									? "Nothing here — all caught up!"
									: "No posts yet — write your first one."}
				</p>
			) : (
				rows.map(({ post, depth }) => (
					<PostCard
						key={post.path}
						post={post}
						depth={depth}
						isReplyTarget={replyTarget?.id === post.id}
						onSelectTag={setSearch}
						onReply={() => setReplyTarget(post)}
					/>
				))
			)}
		</div>
	);

	return (
		<div className="microblog-timeline">
			{composerOnTop ? (
				<>
					{composer}
					{stats}
					{bar}
					{feed}
				</>
			) : (
				<>
					{bar}
					{feed}
					{composer}
					{stats}
				</>
			)}
		</div>
	);
}
