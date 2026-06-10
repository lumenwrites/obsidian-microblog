import { faHashtag, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ChangeEvent, KeyboardEvent, useMemo, useRef, useState } from "react";
import { cn } from "../lib/utils";

/**
 * Normalize a raw tag token to a safe, valid Obsidian tag: trim, drop a leading `#`,
 * and keep only tag-legal characters (letters, digits, `_`, `-`, `/` for nesting).
 * This also prevents YAML-special characters from corrupting the frontmatter we write.
 */
export function normalizeTag(raw: string): string {
	return raw
		.trim()
		.replace(/^#+/, "")
		.replace(/[^\p{L}\p{N}_/-]/gu, "");
}

const has = (tags: string[], t: string) => tags.some((x) => x.toLowerCase() === t.toLowerCase());

/**
 * A controlled tag editor: committed `tags` render as removable chips, and `input`
 * is the in-progress token. A separator (space or comma — typed or pasted) commits
 * the token; Enter commits the highlighted suggestion or the typed token; Backspace
 * on an empty field removes the last chip. `suggestions` (the folder's known tags)
 * autocomplete as you type.
 *
 * State is lifted to the parent (Composer) so it can flush a pending token on submit.
 */
export function TagInput({
	tags,
	input,
	onTagsChange,
	onInputChange,
	suggestions,
}: {
	tags: string[];
	input: string;
	onTagsChange: (tags: string[]) => void;
	onInputChange: (value: string) => void;
	suggestions: string[];
}) {
	const [highlight, setHighlight] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);

	const matches = useMemo(() => {
		const q = input.trim().toLowerCase();
		if (!q) return [];
		return suggestions.filter((t) => !has(tags, t) && t.toLowerCase().includes(q)).slice(0, 8);
	}, [input, tags, suggestions]);

	const commit = (raw: string) => {
		const t = normalizeTag(raw);
		if (t && !has(tags, t)) onTagsChange([...tags, t]);
		onInputChange("");
		setHighlight(0);
	};

	// Split on separators (handles both typing a space/comma and pasting "a, b, c").
	const onChange = (e: ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setHighlight(0);
		if (!/[,\s]/.test(value)) {
			onInputChange(value);
			return;
		}
		const parts = value.split(/[,\s]+/);
		const last = parts.pop() ?? "";
		const next = [...tags];
		for (const part of parts) {
			const t = normalizeTag(part);
			if (t && !has(next, t)) next.push(t);
		}
		if (next.length !== tags.length) onTagsChange(next);
		onInputChange(last);
	};

	const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			if (matches.length) commit(matches[Math.min(highlight, matches.length - 1)]);
			else if (input.trim()) commit(input);
		} else if (e.key === "Backspace" && !input && tags.length) {
			onTagsChange(tags.slice(0, -1));
		} else if (e.key === "ArrowDown" && matches.length) {
			e.preventDefault();
			setHighlight((h) => Math.min(h + 1, matches.length - 1));
		} else if (e.key === "ArrowUp" && matches.length) {
			e.preventDefault();
			setHighlight((h) => Math.max(h - 1, 0));
		}
	};

	return (
		<div className="microblog-taginput" onClick={() => inputRef.current?.focus()}>
			<FontAwesomeIcon icon={faHashtag} className="microblog-taginput-icon" />
			{/* The chips + field scroll horizontally as a unit; the suggestions panel
			    stays outside this row (sibling) so it isn't clipped by the overflow. */}
			<div className="microblog-taginput-row">
				{tags.map((tag) => (
					<button
						key={tag}
						type="button"
						className="microblog-taginput-chip"
						title="Remove tag"
						onClick={() => onTagsChange(tags.filter((x) => x !== tag))}
					>
						<FontAwesomeIcon icon={faHashtag} className="microblog-tag-hash" />
						<span>{tag}</span>
						<FontAwesomeIcon icon={faXmark} />
					</button>
				))}
				<input
					ref={inputRef}
					className="microblog-taginput-field"
					placeholder={tags.length ? "" : "add tags…"}
					value={input}
					onChange={onChange}
					onKeyDown={onKeyDown}
				/>
			</div>
			{matches.length > 0 && (
				<div className="microblog-taginput-suggestions" role="listbox">
					{matches.map((m, i) => (
						<button
							key={m}
							type="button"
							role="option"
							aria-selected={i === highlight}
							className={cn(
								"microblog-taginput-suggestion",
								i === highlight && "is-active",
							)}
							// mousedown (not click) so the input doesn't blur before we commit.
							onMouseDown={(e) => {
								e.preventDefault();
								commit(m);
							}}
						>
							{m}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
