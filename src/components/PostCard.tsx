import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
	faArrowDown,
	faArrowUp,
	faBoxArchive,
	faCheck,
	faEllipsis,
	faPenToSquare,
	faReply,
	faShareNodes,
	faSquare,
	faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Notice } from "obsidian";
import { useState } from "react";
import { useApp, useSettings } from "../context/PluginContext";
import { adjustScore, archivePost, deletePost, openPost, setDone } from "../lib/posts";
import { cn, formatPostDate, run } from "../lib/utils";
import type { Post } from "../types";
import { Dropdown } from "./Dropdown";
import { MarkdownPreview } from "./MarkdownPreview";

/** How many nesting levels still add indentation before it's capped (deep threads). */
const MAX_INDENT_DEPTH = 5;

/** A row in the ⋯ overflow menu. */
interface MenuItem {
	icon: IconDefinition;
	label: string;
	onClick: () => void;
	danger?: boolean;
}

/**
 * One post in the timeline: the rendered markdown body (folded behind "read more"
 * when longer than the soft limit) with a bottom-right footer holding the meta and
 * primary actions (date, score, vote, edit) plus a ⋯ menu for the rest (done, reply,
 * share, archive, delete).
 *
 * All vault mutations go through `run()` so a failed write surfaces a Notice instead
 * of being silently swallowed by `void`.
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
	const done = post.done != null;

	const share = () => {
		// Cross-posting (Bluesky/Mastodon) is a planned feature — see spec.md.
		new Notice("Cross-posting isn't set up yet.");
	};

	const menuItems: MenuItem[] = [
		{
			icon: done ? faCheck : faSquare,
			label: "Done",
			onClick: () => void run(() => setDone(app, post.file, !done), "Couldn't update done"),
		},
		{ icon: faReply, label: "Reply", onClick: onReply },
		{ icon: faShareNodes, label: "Share", onClick: share },
		{
			icon: faBoxArchive,
			label: "Archive",
			onClick: () =>
				void run(async () => {
					await archivePost(app, post.file);
					new Notice("Moved to archived.");
				}, "Couldn't archive"),
		},
		{
			icon: faTrash,
			label: "Delete",
			danger: true,
			onClick: () => void run(() => deletePost(app, post.file), "Couldn't delete"),
		},
	];

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
				{done && (
					<span className="microblog-post-done" title="Done">
						<FontAwesomeIcon icon={faCheck} />
					</span>
				)}
				<span className="microblog-post-date">{formatPostDate(post.created)}</span>
				<span className="microblog-post-score">{post.score}</span>
				<div className="microblog-post-actions">
					<button
						className="microblog-icon-btn"
						title="Upvote"
						onClick={() => void run(() => adjustScore(app, post.file, 1), "Couldn't update score")}
					>
						<FontAwesomeIcon icon={faArrowUp} />
					</button>
					<button
						className="microblog-icon-btn"
						title="Downvote"
						onClick={() => void run(() => adjustScore(app, post.file, -1), "Couldn't update score")}
					>
						<FontAwesomeIcon icon={faArrowDown} />
					</button>
					<button
						className="microblog-icon-btn"
						title="Edit in editor"
						onClick={() => void run(() => openPost(app, post.file), "Couldn't open note")}
					>
						<FontAwesomeIcon icon={faPenToSquare} />
					</button>
					<Dropdown
						align="right"
						trigger={({ open, toggle }) => (
							<button
								className="microblog-icon-btn"
								title="More actions"
								aria-haspopup="true"
								aria-expanded={open}
								onClick={toggle}
							>
								<FontAwesomeIcon icon={faEllipsis} />
							</button>
						)}
					>
						{(close) =>
							menuItems.map((item) => (
								<button
									key={item.label}
									className={cn("microblog-dropdown-item", item.danger && "is-danger")}
									role="menuitem"
									onClick={() => {
										close();
										item.onClick();
									}}
								>
									<FontAwesomeIcon icon={item.icon} />
									<span>{item.label}</span>
								</button>
							))
						}
					</Dropdown>
				</div>
			</footer>
		</article>
	);
}
