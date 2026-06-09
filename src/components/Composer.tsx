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
			setValue("");
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
		// Obsidian's native mobile toolbar (the bar above the soft keyboard) is hard-wired
		// to the active CodeMirror editor. Our composer is a plain <textarea> in a custom
		// view, so when it's focused the toolbar has no editor to populate itself from and
		// renders as an empty, tall black bar. We flag the body while focused so CSS can hide
		// that broken shell (see styles.css → `.mobile-toolbar`). Cleanup clears the flag even
		// if we unmount while still focused (blur wouldn't fire).
		const FOCUS_CLASS = "microblog-composer-focused";
		// The toolbar is created *after* focus (once the keyboard animates up), so we also
		// re-hide on a short delay and report what we actually find. The Notice is a
		// temporary mobile-friendly diagnostic so we can confirm the real element/class.
		let diag: number | undefined;
		const onFocus = () => {
			activeDocument.body.addClass(FOCUS_CLASS);
			window.clearTimeout(diag);
			diag = window.setTimeout(() => {
				// Find every wide fixed/absolute bar in the lower half of the screen, whatever
				// its class. Reports tag.class plus vertical extent (top–bottom, height) so we
				// can identify the mystery black bar even if it has an unexpected class name.
				const vw = window.innerWidth;
				const vh = window.innerHeight;
				const hits: string[] = [];
				activeDocument.querySelectorAll<HTMLElement>("body *").forEach((el) => {
					const cs = window.getComputedStyle(el);
					if (cs.position !== "fixed" && cs.position !== "absolute") return;
					const r = el.getBoundingClientRect();
					if (r.width < vw * 0.6 || r.height === 0 || r.bottom < vh * 0.4) return;
					const klass = el.getAttribute("class")?.trim() || "(no class)";
					hits.push(
						`${el.tagName.toLowerCase()}.${klass} | y ${Math.round(r.top)}–${Math.round(r.bottom)} h${Math.round(r.height)}`,
					);
				});
				new Notice(
					`bottom bars (vh=${Math.round(vh)}):\n${hits.join("\n") || "none"}`,
					20000,
				);
			}, 700);
		};
		const onBlur = () => {
			activeDocument.body.removeClass(FOCUS_CLASS);
			window.clearTimeout(diag);
		};
		el.addEventListener("keydown", onKeyDown, true);
		el.addEventListener("focus", onFocus);
		el.addEventListener("blur", onBlur);
		return () => {
			el.removeEventListener("keydown", onKeyDown, true);
			el.removeEventListener("focus", onFocus);
			el.removeEventListener("blur", onBlur);
			window.clearTimeout(diag);
			activeDocument.body.removeClass(FOCUS_CLASS);
		};
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
				placeholder="Write something funny…"
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
