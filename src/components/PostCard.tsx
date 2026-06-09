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
import { useEffect, useRef, useState } from "react";
import { useApp, useSettings } from "../context/PluginContext";
import { adjustScore, archivePost, deletePost, openPost, setDone } from "../lib/posts";
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

	const archive = async () => {
		await archivePost(app, post.file);
		new Notice("Moved to archived.");
	};

	const done = post.done != null;
	const toggleDone = async () => {
		await setDone(app, post.file, !done);
	};

	// The ⋯ button opens a small custom dropdown anchored to its bottom-right,
	// holding the secondary actions (reply, share, archive, delete) as icon buttons
	// styled like the footer action buttons. We close it on outside-click / Escape.
	const [menuOpen, setMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!menuOpen) return;
		const onPointerDown = (e: PointerEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setMenuOpen(false);
			}
		};
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") setMenuOpen(false);
		};
		activeDocument.addEventListener("pointerdown", onPointerDown);
		activeDocument.addEventListener("keydown", onKeyDown);
		return () => {
			activeDocument.removeEventListener("pointerdown", onPointerDown);
			activeDocument.removeEventListener("keydown", onKeyDown);
		};
	}, [menuOpen]);

	// Close the dropdown, then run the chosen action.
	const runAction = (fn: () => void) => {
		setMenuOpen(false);
		fn();
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
				{done && (
					<span className="microblog-post-done" title="Done">
						<FontAwesomeIcon icon={faCheck} />
					</span>
				)}
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
					<div className="microblog-post-menu" ref={menuRef}>
						<button
							title="More actions"
							aria-haspopup="true"
							aria-expanded={menuOpen}
							onClick={() => setMenuOpen((v) => !v)}
						>
							<FontAwesomeIcon icon={faEllipsis} />
						</button>
						{menuOpen && (
							<div className="microblog-post-menu-dropdown" role="menu">
								<button role="menuitem" onClick={() => runAction(() => void toggleDone())}>
									<FontAwesomeIcon icon={done ? faCheck : faSquare} />
									<span>Done</span>
								</button>
								<button role="menuitem" onClick={() => runAction(onReply)}>
									<FontAwesomeIcon icon={faReply} />
									<span>Reply</span>
								</button>
								<button role="menuitem" onClick={() => runAction(share)}>
									<FontAwesomeIcon icon={faShareNodes} />
									<span>Share</span>
								</button>
								<button
									role="menuitem"
									onClick={() => runAction(() => void archive())}
								>
									<FontAwesomeIcon icon={faBoxArchive} />
									<span>Archive</span>
								</button>
								<button
									role="menuitem"
									className="is-danger"
									onClick={() => runAction(() => void deletePost(app, post.file))}
								>
									<FontAwesomeIcon icon={faTrash} />
									<span>Delete</span>
								</button>
							</div>
						)}
					</div>
				</div>
			</footer>
		</article>
	);
}
