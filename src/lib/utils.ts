import { clsx, type ClassValue } from "clsx";
import { Notice } from "obsidian";

/**
 * Conditional className joiner. Plain `clsx` — no `tailwind-merge`, since we use
 * hand-written CSS (scoped under `.microblog-root`), not utility classes.
 */
export function cn(...inputs: ClassValue[]): string {
	return clsx(inputs);
}

/**
 * Run a fire-and-forget vault action, surfacing failures instead of swallowing them:
 * logs to the console and shows a Notice with `failMsg`. Use for the post mutations
 * (score, done, archive, delete, open) so a failed write isn't silent.
 *
 * Usage: `void run(() => adjustScore(app, file, 1), "Couldn't update score")`.
 */
export async function run(action: () => Promise<unknown>, failMsg: string): Promise<void> {
	try {
		await action();
	} catch (e) {
		console.error(`[microblog] ${failMsg}`, e);
		new Notice(failMsg);
	}
}

/** Human-readable post timestamp, e.g. "Jun 9, 2026, 2:32 PM". */
export function formatPostDate(ts: number): string {
	return new Date(ts).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}
