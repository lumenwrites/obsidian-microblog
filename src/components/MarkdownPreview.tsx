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
}: {
	markdown: string;
	sourcePath: string;
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

		return () => {
			component.unload();
			el.empty();
		};
	}, [app, markdown, sourcePath]);

	return <div className="microblog-markdown" ref={ref} />;
}
