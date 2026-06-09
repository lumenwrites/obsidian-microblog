import { App, getAllTags, normalizePath, TFile, TFolder } from "obsidian";
import type { Post } from "../types";

/**
 * Data layer: maps post files ↔ `Post`, scoped to a single timeline folder.
 *
 * No custom parser/serializer — everything goes through Obsidian's own APIs
 * (vault / metadataCache / fileManager). Every mutating call builds its path under
 * `folderPath`; we never touch arbitrary vault paths (we run in the real vault).
 *
 * Each post is one markdown file named with a sortable timestamp, e.g.
 * `2026-06-09T143203.md` (= 2026-06-09 14:32:03).
 */

const TIMESTAMP_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})(\d{2})(\d{2})/;

function pad(n: number): string {
	return String(n).padStart(2, "0");
}

/** `Date` → filename stem like `2026-06-09T143203` (filesystem-safe, no colons). */
function timestampName(d: Date): string {
	return (
		`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
		`T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
	);
}

/** Parse the creation time from a post filename stem; null if it doesn't match. */
function parseTimestamp(basename: string): number | null {
	const m = TIMESTAMP_RE.exec(basename);
	if (!m) return null;
	const [, y, mo, d, h, mi, s] = m;
	return new Date(+y, +mo - 1, +d, +h, +mi, +s).getTime();
}

/** Strip the YAML frontmatter block from raw file content, using the cached position. */
function stripFrontmatter(content: string, endOffset: number | undefined): string {
	const body = endOffset != null ? content.slice(endOffset) : content;
	return body.replace(/^\s*\n/, "");
}

/** The markdown files directly inside `folderPath` (non-recursive). */
export function listPostFiles(app: App, folderPath: string): TFile[] {
	const folder = app.vault.getAbstractFileByPath(normalizePath(folderPath));
	if (!(folder instanceof TFolder)) return [];
	return folder.children.filter(
		(f): f is TFile => f instanceof TFile && f.extension === "md",
	);
}

/** Read one file into a `Post` (frontmatter + tags from cache, body from disk). */
export async function loadPost(app: App, file: TFile): Promise<Post> {
	const cache = app.metadataCache.getFileCache(file);
	const fm = cache?.frontmatter ?? {};
	const content = await app.vault.cachedRead(file);

	const score = typeof fm.score === "number" ? fm.score : 0;
	const shared = typeof fm.shared === "string" ? fm.shared : undefined;
	const replyTo = typeof fm.reply_to === "string" ? fm.reply_to : undefined;

	return {
		file,
		path: file.path,
		id: file.basename,
		created: parseTimestamp(file.basename) ?? file.stat.ctime,
		body: stripFrontmatter(content, cache?.frontmatterPosition?.end.offset),
		score,
		shared,
		replyTo,
		tags: cache ? (getAllTags(cache) ?? []) : [],
	};
}

/** Load every post in the folder. Order is decided by the caller (see usePosts). */
export async function loadPosts(app: App, folderPath: string): Promise<Post[]> {
	return Promise.all(listPostFiles(app, folderPath).map((f) => loadPost(app, f)));
}

/**
 * Create a new post file in the folder (creating the folder if needed).
 * Pass `replyTo` (a parent post's id) to make this a reply in a thread.
 */
export async function createPost(
	app: App,
	folderPath: string,
	body: string,
	replyTo?: string,
): Promise<TFile> {
	const dir = normalizePath(folderPath);
	if (!(app.vault.getAbstractFileByPath(dir) instanceof TFolder)) {
		await app.vault.createFolder(dir);
	}

	// Resolve filename collisions (multiple posts in the same second).
	const stem = timestampName(new Date());
	let path = `${dir}/${stem}.md`;
	for (let i = 1; app.vault.getAbstractFileByPath(path); i++) {
		path = `${dir}/${stem}-${i}.md`;
	}

	// reply_to is quoted so YAML never coerces the timestamp-like id to a date.
	const frontmatter = replyTo
		? `---\nscore: 0\nreply_to: "${replyTo}"\n---\n`
		: `---\nscore: 0\n---\n`;
	return app.vault.create(path, `${frontmatter}${body.trim()}\n`);
}

/** Add `delta` to a post's score (atomic frontmatter read-modify-write). */
export async function adjustScore(app: App, file: TFile, delta: number): Promise<void> {
	await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
		const current = typeof fm.score === "number" ? fm.score : 0;
		fm.score = current + delta;
	});
}

/** Subfolders (beside the post, inside the timeline folder) posts get moved into. */
export const ARCHIVE_DIR = "archived";
export const TRASH_DIR = "trash";

/**
 * Move a post into a `<subdir>/` folder next to it (created if needed). Because the
 * timeline lists only *direct* children of its folder, the post drops out of the
 * timeline and stats but stays in the vault — reversible (move it back), and the
 * subfolder can itself be opened as a timeline. Uses `renameFile` so links are kept.
 */
async function moveToSubfolder(app: App, file: TFile, subdir: string): Promise<void> {
	const parent = file.parent?.path ?? "";
	const dir = normalizePath(parent ? `${parent}/${subdir}` : subdir);
	if (!(app.vault.getAbstractFileByPath(dir) instanceof TFolder)) {
		await app.vault.createFolder(dir);
	}

	let target = `${dir}/${file.name}`;
	for (let i = 1; app.vault.getAbstractFileByPath(target); i++) {
		target = `${dir}/${file.basename}-${i}.${file.extension}`;
	}
	await app.fileManager.renameFile(file, target);
}

/** Move a post into the timeline's `archived/` subfolder. */
export async function archivePost(app: App, file: TFile): Promise<void> {
	await moveToSubfolder(app, file, ARCHIVE_DIR);
}

/** Move a post into the timeline's `trash/` subfolder (beside `archived/`). */
export async function deletePost(app: App, file: TFile): Promise<void> {
	await moveToSubfolder(app, file, TRASH_DIR);
}

/** Open a post in a new tab for full editing in Obsidian's real editor. */
export async function openPost(app: App, file: TFile): Promise<void> {
	await app.workspace.getLeaf("tab").openFile(file);
}
