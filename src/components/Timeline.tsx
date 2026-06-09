import { useEffect, useMemo, useRef, useState } from "react";
import { useApp, useFolderPath, useSettings } from "../context/PluginContext";
import { usePosts } from "../hooks/usePosts";
import { createPost } from "../lib/posts";
import type { Post, SortOrder } from "../types";
import { Composer } from "./Composer";
import { PostCard } from "./PostCard";
import { SearchSortBar } from "./SearchSortBar";

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
	const [replyTarget, setReplyTarget] = useState<Post | null>(null);
	const feedRef = useRef<HTMLDivElement>(null);

	const query = search.trim().toLowerCase();
	// Composer-at-bottom: roots ascending (newest/top nearest the composer below).
	// Composer-at-top: descending (newest/top first, just under the composer above).
	const dir = composerOnTop ? -1 : 1;

	const rows = useMemo<Row[]>(() => {
		const compareRoots = (a: Post, b: Post) =>
			dir *
			(sort === "score" ? a.score - b.score || a.created - b.created : a.created - b.created);

		// Search: a flat list of matching posts (replies included).
		if (query) {
			const matches = (p: Post) =>
				p.body.toLowerCase().includes(query) ||
				p.tags.some((t) => t.toLowerCase().includes(query));
			return posts
				.filter(matches)
				.sort(compareRoots)
				.map((post) => ({ post, depth: 0 }));
		}

		// Threaded: parent → children, plus the roots (top-level or orphaned replies).
		const byId = new Map(posts.map((p) => [p.id, p]));
		const childrenOf = new Map<string, Post[]>();
		const roots: Post[] = [];
		for (const p of posts) {
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
	}, [posts, query, sort, dir]);

	// Anchor the feed to the composer's edge whenever the visible set changes.
	useEffect(() => {
		const el = feedRef.current;
		if (el) el.scrollTop = composerOnTop ? 0 : el.scrollHeight;
	}, [rows.length, composerOnTop]);

	const addPost = async (body: string) => {
		await createPost(app, folderPath, body, replyTarget?.id);
		setReplyTarget(null);
	};

	const bar = <SearchSortBar search={search} onSearch={setSearch} sort={sort} onSort={setSort} />;
	const composer = (
		<Composer
			onSubmit={addPost}
			atTop={composerOnTop}
			replyingTo={replyTarget}
			onCancelReply={() => setReplyTarget(null)}
		/>
	);
	const feed = (
		<div className="microblog-feed" ref={feedRef}>
			{rows.length === 0 ? (
				<p className="microblog-empty">
					{query ? "No posts match your search." : "No posts yet — write your first one."}
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
