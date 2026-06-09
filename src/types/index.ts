import type { TFile } from "obsidian";

/**
 * A single microblog post = one markdown file in the timeline folder.
 * Shape for the upcoming data layer (`lib/posts.ts`); not wired up by the scaffold yet.
 */
export interface Post {
	file: TFile;
	path: string;
	/** Stable id within the folder = the filename stem (e.g. `2026-06-09T143203`). */
	id: string;
	/** Creation time, parsed from the filename timestamp (e.g. 2026-06-09T143203.md). */
	created: number;
	/** Last-modified time (file mtime). Used by the Resurface sort. */
	modified: number;
	/** Markdown body, without frontmatter. */
	body: string;
	/** Reddit-style manual rank (frontmatter `score`). */
	score: number;
	/** External id once cross-posted (frontmatter `shared`). */
	shared?: string;
	/** Future threading (frontmatter `reply_to`). */
	replyTo?: string;
	/** ISO timestamp set when marked done (frontmatter `done`); absent = not done. */
	done?: string;
	/** Hashtags, from Obsidian's MetadataCache. */
	tags: string[];
}

/** Newest = chronological, Top = by score, Resurface = review-priority (stale × score). */
export type SortOrder = "chronological" | "score" | "resurface";

/** Timeline filter by completion state. */
export type DoneFilter = "all" | "done" | "notdone";
