import { faPaperPlane, faReply, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Notice } from "obsidian";
import { useEffect, useRef, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { useSettings } from "../context/PluginContext";
import { cn } from "../lib/utils";
import type { Post } from "../types";
import { CharCountRing } from "./CharCountRing";

/** One-line preview of the post being replied to, for the composer banner. */
function replySnippet(post: Post): string {
	const text = post.body.replace(/\s+/g, " ").trim();
	return text.length > 60 ? `${text.slice(0, 60)}…` : text || "(empty post)";
}

/**
 * The composer: an auto-growing textarea, a circular char-count indicator, and the
 * NOTE button. Cmd/Ctrl/Shift+Enter submits; plain Enter inserts a newline. `atTop`
 * flips its divider when it sits above the feed instead of below. (Editing existing
 * posts happens in Obsidian's real editor via the post's Edit action — see PostCard.)
 */
export function Composer({
	onSubmit,
	atTop = false,
	replyingTo = null,
	onCancelReply,
}: {
	onSubmit: (body: string) => Promise<void>;
	atTop?: boolean;
	replyingTo?: Post | null;
	onCancelReply?: () => void;
}) {
	const settings = useSettings();
	const [value, setValue] = useState("");
	const [busy, setBusy] = useState(false);
	const trimmed = value.trim();

	const submit = async () => {
		if (!trimmed || busy) return;
		setBusy(true);
		try {
			await onSubmit(trimmed);
			setValue(""); // only cleared on success — a failed post keeps your text
		} catch (e) {
			console.error("[microblog] Couldn't post", e);
			new Notice("Couldn't post — see console.");
		} finally {
			setBusy(false);
		}
	};

	// Submit shortcut via a native capture-phase listener on the textarea. We do this
	// instead of React's onKeyDown so it runs *before* any bubble-phase hotkey handler
	// (e.g. an Obsidian "Mod+Enter" binding, which is why Cmd+Enter could otherwise be
	// swallowed before reaching React). stopPropagation keeps Obsidian from also acting.
	// Shift+Enter is included because it isn't a registered hotkey, so it's the most
	// reliable modifier; plain Enter still inserts a newline.
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const submitRef = useRef(submit);
	submitRef.current = submit;

	useEffect(() => {
		const el = textareaRef.current;
		if (!el) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey || e.shiftKey) && e.key === "Enter") {
				e.preventDefault();
				e.stopPropagation();
				void submitRef.current();
			}
		};
		el.addEventListener("keydown", onKeyDown, true);
		return () => el.removeEventListener("keydown", onKeyDown, true);
	}, []);

	// Focus the textarea when a reply target is set, so you can type immediately.
	useEffect(() => {
		if (replyingTo) textareaRef.current?.focus();
	}, [replyingTo]);

	return (
		<div className={cn("microblog-composer", atTop && "is-top")}>
			{replyingTo && (
				<div className="microblog-reply-banner">
					<FontAwesomeIcon icon={faReply} />
					<span className="microblog-reply-snippet">
						Replying to: {replySnippet(replyingTo)}
					</span>
					<button title="Cancel reply" onClick={onCancelReply}>
						<FontAwesomeIcon icon={faXmark} />
					</button>
				</div>
			)}
			<TextareaAutosize
				ref={textareaRef}
				className="microblog-composer-input"
				placeholder="Write something…"
				value={value}
				minRows={2}
				maxRows={12}
				onChange={(e) => setValue(e.target.value)}
			/>
			<div className="microblog-composer-actions">
				<CharCountRing count={value.length} limit={settings.charLimit} />
				<button
					className="microblog-note-btn"
					disabled={!trimmed || busy}
					onClick={() => void submit()}
				>
					<FontAwesomeIcon icon={faPaperPlane} /> NOTE
				</button>
			</div>
		</div>
	);
}
