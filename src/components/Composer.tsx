import { faPaperPlane } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { KeyboardEvent, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { useSettings } from "../context/PluginContext";
import { CharCountRing } from "./CharCountRing";

/**
 * The bottom composer: an auto-growing textarea, a circular char-count indicator,
 * and the NOTE button. Cmd/Ctrl+Enter submits. (Editing existing posts happens in
 * Obsidian's real editor via the post's Edit action — see PostCard.)
 */
export function Composer({ onSubmit }: { onSubmit: (body: string) => Promise<void> }) {
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

	const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
			e.preventDefault();
			void submit();
		}
	};

	return (
		<div className="microblog-composer">
			<TextareaAutosize
				className="microblog-composer-input"
				placeholder="Write something funny…"
				value={value}
				minRows={2}
				maxRows={12}
				onChange={(e) => setValue(e.target.value)}
				onKeyDown={onKeyDown}
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
