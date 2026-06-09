import { clsx, type ClassValue } from "clsx";

/**
 * Conditional className joiner. Plain `clsx` — no `tailwind-merge`, since we use
 * hand-written CSS (scoped under `.microblog-root`), not utility classes.
 */
export function cn(...inputs: ClassValue[]): string {
	return clsx(inputs);
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
