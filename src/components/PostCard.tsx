import {
	faArrowDown,
	faArrowUp,
	faPenToSquare,
	faShareNodes,
	faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Notice } from "obsidian";
import { useState } from "react";
import { useApp, useSettings } from "../context/PluginContext";
import { adjustScore, deletePost, openPost } from "../lib/posts";
import { cn, formatPostDate } from "../lib/utils";
import type { Post } from "../types";
import { MarkdownPreview } from "./MarkdownPreview";

/**
 * One post in the timeline: metadata + actions header, the rendered markdown body
 * (folded behind "read more" when longer than the soft limit), and clickable tags.
 */
export function PostCard({
	post,
	onSelectTag,
}: {
	post: Post;
	onSelectTag: (tag: string) => void;
}) {
	const app = useApp();
	const settings = useSettings();
	const [expanded, setExpanded] = useState(false);
	const foldable = post.body.length > settings.charLimit;

	const share = () => {
		// Cross-posting (Bluesky/Mastodon) is a planned feature — see spec.md.
		new Notice("Cross-posting isn't set up yet.");
	};

	return (
		<article className="microblog-post">
			<div className="microblog-post-header">
				<span className="microblog-post-date">{formatPostDate(post.created)}</span>
				<span className="microblog-post-score">{post.score}</span>
				<div className="microblog-post-actions">
					<button title="Upvote" onClick={() => void adjustScore(app, post.file, 1)}>
						<FontAwesomeIcon icon={faArrowUp} />
					</button>
					<button title="Downvote" onClick={() => void adjustScore(app, post.file, -1)}>
						<FontAwesomeIcon icon={faArrowDown} />
					</button>
					<button title="Share" onClick={share}>
						<FontAwesomeIcon icon={faShareNodes} />
					</button>
					<button title="Edit in editor" onClick={() => void openPost(app, post.file)}>
						<FontAwesomeIcon icon={faPenToSquare} />
					</button>
					<button title="Delete" onClick={() => void deletePost(app, post.file)}>
						<FontAwesomeIcon icon={faTrash} />
					</button>
				</div>
			</div>

			<div className={cn("microblog-post-body", foldable && !expanded && "is-collapsed")}>
				<MarkdownPreview markdown={post.body} sourcePath={post.path} />
			</div>

			{foldable && (
				<button className="microblog-readmore" onClick={() => setExpanded((v) => !v)}>
					{expanded ? "Show less" : "Read more"}
				</button>
			)}

			{post.tags.length > 0 && (
				<div className="microblog-post-tags">
					{post.tags.map((tag) => (
						<button key={tag} className="microblog-tag" onClick={() => onSelectTag(tag)}>
							{tag}
						</button>
					))}
				</div>
			)}
		</article>
	);
}
