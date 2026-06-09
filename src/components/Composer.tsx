import { faPaperPlane, faReply, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Notice } from "obsidian";
import { useEffect, useRef, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { useSettings } from "../context/PluginContext";
import { cn } from "../lib/utils";
import type { Post } from "../types";
import { CharCountRing } from "./CharCountRing";

/**
 * Obsidian mobile is a Capacitor app; its bundled Keyboard plugin is reachable at
 * `window.Capacitor.Plugins.Keyboard`. We only need `setAccessoryBarVisible` to hide the
 * native iOS bar that sits above the keyboard for a focused <textarea>. Returns undefined
 * on desktop (no Capacitor) so callers can no-op safely.
 */
interface CapacitorKeyboard {
	setAccessoryBarVisible?: (opts: { isVisible: boolean }) => void;
}
function getCapacitorKeyboard(): CapacitorKeyboard | undefined {
	const cap = (window as unknown as {
		Capacitor?: { Plugins?: { Keyboard?: CapacitorKeyboard } };
	}).Capacitor;
	return cap?.Plugins?.Keyboard;
}

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
		// The tall black bar above the keyboard is the native iOS input-accessory view that
		// WKWebView puts over a focused <textarea>. It is NOT a DOM element (confirmed: no
		// `.mobile-toolbar` exists and a position scan found no bottom bar), so CSS can't
		// touch it. Obsidian hides it for its own editor and draws `.mobile-toolbar` instead;
		// our plain textarea gets the raw native bar. The only lever from JS is Obsidian's
		// bundled Capacitor Keyboard plugin: `setAccessoryBarVisible({ isVisible: false })`.
		// We hide it on focus and restore on blur so other parts of the app are unaffected.
		// The body class is kept only so the (harmless) CSS rule can still catch a stray
		// `.mobile-toolbar` if one ever appears. Cleanup runs even if we unmount while focused.
		const FOCUS_CLASS = "microblog-composer-focused";
		const keyboard = getCapacitorKeyboard();
		let probed = false;
		const onFocus = () => {
			activeDocument.body.addClass(FOCUS_CLASS);
			keyboard?.setAccessoryBarVisible?.({ isVisible: false });
			// One-time probe so we can confirm on-device whether the bridge is even present.
			if (!probed) {
				probed = true;
				new Notice(`keyboard bridge: ${keyboard ? "found" : "MISSING"}`, 6000);
			}
		};
		const onBlur = () => {
			activeDocument.body.removeClass(FOCUS_CLASS);
			keyboard?.setAccessoryBarVisible?.({ isVisible: true });
		};
		el.addEventListener("keydown", onKeyDown, true);
		el.addEventListener("focus", onFocus);
		el.addEventListener("blur", onBlur);
		return () => {
			el.removeEventListener("keydown", onKeyDown, true);
			el.removeEventListener("focus", onFocus);
			el.removeEventListener("blur", onBlur);
			activeDocument.body.removeClass(FOCUS_CLASS);
			keyboard?.setAccessoryBarVisible?.({ isVisible: true });
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
