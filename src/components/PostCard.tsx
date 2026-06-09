import {
	faArrowDown,
	faArrowUp,
	faEllipsis,
	faPenToSquare,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Menu, Notice } from "obsidian";
import { MouseEvent, useState } from "react";
import { useApp, useSettings } from "../context/PluginContext";
import { confirm } from "../lib/confirm";
import { adjustScore, deletePost, openPost } from "../lib/posts";
import { cn, formatPostDate } from "../lib/utils";
import type { Post } from "../types";
import { MarkdownPreview } from "./MarkdownPreview";

/** How many nesting levels still add indentation before it's capped (deep threads). */
const MAX_INDENT_DEPTH = 5;

/**
 * One post in the timeline: the rendered markdown body (folded behind "read more"
 * when longer than the soft limit) with a bottom-right footer holding the meta and
 * primary actions (date, score, vote, edit) plus a ⋯ menu for the rest (reply, share,
 * delete).
 *
 * `depth` is its position in a reply thread (0 = root); it indents and draws a thread
 * line. `isReplyTarget` highlights the post currently being replied to.
 */
export function PostCard({
	post,
	depth,
	isReplyTarget,
	onSelectTag,
	onReply,
}: {
	post: Post;
	depth: number;
	isReplyTarget: boolean;
	onSelectTag: (tag: string) => void;
	onReply: () => void;
}) {
	const app = useApp();
	const settings = useSettings();
	const [expanded, setExpanded] = useState(false);
	const foldable = post.body.length > settings.charLimit;

	const share = () => {
		// Cross-posting (Bluesky/Mastodon) is a planned feature — see spec.md.
		new Notice("Cross-posting isn't set up yet.");
	};

	const remove = async () => {
		const ok = await confirm(app, {
			title: "Delete post",
			message: "This moves the note to your vault trash. You can restore it from there.",
			cta: "Delete",
			danger: true,
		});
		if (ok) await deletePost(app, post.file);
	};

	// The ⋯ menu holds the secondary actions (reply, share, delete) as an Obsidian Menu.
	const openMenu = (e: MouseEvent) => {
		const menu = new Menu();
		menu.addItem((item) => item.setTitle("Reply").setIcon("reply").onClick(onReply));
		menu.addItem((item) => item.setTitle("Share").setIcon("share").onClick(share));
		menu.addItem((item) =>
			item
				.setTitle("Delete")
				.setIcon("trash")
				.setWarning(true)
				.onClick(() => void remove()),
		);
		// Tag the menu DOM so we can scope larger, touch-friendly item sizing to it
		// (Menu.dom isn't in the public typings, but it's the rendered container).
		(menu as Menu & { dom?: HTMLElement }).dom?.addClass("microblog-post-menu");
		menu.showAtMouseEvent(e.nativeEvent);
	};

	return (
		<article
			className={cn(
				"microblog-post",
				depth > 0 && "is-reply",
				isReplyTarget && "is-reply-target",
			)}
			style={{ marginInlineStart: `${Math.min(depth, MAX_INDENT_DEPTH) * 1.25}rem` }}
		>
			<div className={cn("microblog-post-body", foldable && !expanded && "is-collapsed")}>
				<MarkdownPreview
					markdown={post.body}
					sourcePath={post.path}
					onTagClick={onSelectTag}
				/>
			</div>

			{foldable && (
				<button className="microblog-readmore" onClick={() => setExpanded((v) => !v)}>
					{expanded ? "Show less" : "Read more"}
				</button>
			)}

			<footer className="microblog-post-footer">
				<span className="microblog-post-date">{formatPostDate(post.created)}</span>
				<span className="microblog-post-score">{post.score}</span>
				<div className="microblog-post-actions">
					<button title="Upvote" onClick={() => void adjustScore(app, post.file, 1)}>
						<FontAwesomeIcon icon={faArrowUp} />
					</button>
					<button title="Downvote" onClick={() => void adjustScore(app, post.file, -1)}>
						<FontAwesomeIcon icon={faArrowDown} />
					</button>
					<button title="Edit in editor" onClick={() => void openPost(app, post.file)}>
						<FontAwesomeIcon icon={faPenToSquare} />
					</button>
					<button title="More actions" onClick={openMenu}>
						<FontAwesomeIcon icon={faEllipsis} />
					</button>
				</div>
			</footer>
		</article>
	);
}
