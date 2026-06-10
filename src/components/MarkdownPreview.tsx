import { Component, MarkdownRenderer } from "obsidian";
import { useEffect, useRef } from "react";
import { useApp } from "../context/PluginContext";

/**
 * Renders markdown the way Obsidian renders notes, via `MarkdownRenderer.render`.
 *
 * Three correctness details:
 *  - a per-render child `Component` is created and `unload()`ed on cleanup, so
 *    embeds/links/post-processors register *and* unregister;
 *  - `sourcePath` is the post's own file path, so relative links, embeds, and
 *    [[wikilinks]] resolve (each post is a real note);
 *  - the container is emptied before each render so DOM doesn't stack on edits.
 */
export function MarkdownPreview({
	markdown,
	sourcePath,
	onTagClick,
}: {
	markdown: string;
	sourcePath: string;
	/** Intercept clicks on inline #tags (rendered by Obsidian) to drive our search. */
	onTagClick?: (tag: string) => void;
}) {
	const app = useApp();
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		el.empty();
		const component = new Component();
		component.load();
		void MarkdownRenderer.render(app, markdown, el, sourcePath, component);

		// Capture-phase so we run before Obsidian's own tag handler (global search).
		const onClick = (e: MouseEvent) => {
			const tag = (e.target as HTMLElement).closest("a.tag");
			if (tag && onTagClick) {
				e.preventDefault();
				e.stopPropagation();
				// Strip the leading "#" so it matches our frontmatter-tag search terms.
				onTagClick(tag.getText().replace(/^#/, ""));
			}
		};
		el.addEventListener("click", onClick, true);

		return () => {
			el.removeEventListener("click", onClick, true);
			component.unload();
			el.empty();
		};
	}, [app, markdown, sourcePath, onTagClick]);

	// `markdown-rendered` is the class Obsidian's reading-view CSS is scoped under, so it's
	// what gives blockquotes their left bar, plus callouts/tables/code-block styling, etc.
	// Without it, MarkdownRenderer.render emits correct HTML but it renders unstyled.
	return <div className="microblog-markdown markdown-rendered" ref={ref} />;
}
