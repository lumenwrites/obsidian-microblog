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

/** Full post timestamp for tooltips, e.g. "Jun 9, 2026, 2:32 PM". */
export function formatPostDate(ts: number): string {
	return new Date(ts).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

/**
 * Compact relative age, reddit/bluesky style: "now", "5m", "3h", "4d", "2w", "5mo",
 * "1y". Computed on render (doesn't tick); reloads recompute it. `now` is injectable
 * for testing.
 */
export function formatRelativeDate(ts: number, now: number = Date.now()): string {
	const seconds = Math.max(0, Math.floor((now - ts) / 1000));
	if (seconds < 60) return "now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d`;
	if (days < 30) return `${Math.floor(days / 7)}w`;
	const months = Math.floor(days / 30);
	if (months < 12) return `${months}mo`;
	return `${Math.floor(days / 365)}y`;
}
