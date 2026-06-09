import type { Post } from "../types";

/**
 * Pure stats math for the streak widget. Days are local (boundary = local midnight).
 * `now` is passed in so the functions are deterministic and testable.
 *
 * One carry pass (`dayStats`) computes everything: surplus posts beyond the daily goal
 * flow backward to repair earlier unmet days within a window, and both the contribution
 * graph and the streak read from the same result — so a backfilled day shows as filled
 * *and* counts toward the streak, consistently.
 */

/** Recent days whose gaps surplus posts may backfill (repair window). */
export const BACKFILL_DAYS = 14;

/** Days shown in the contribution graph. */
export const GRAPH_DAYS = 30;

/** Upper bound on history scanned for the streak. */
const MAX_DAYS = 400;

/** Local `YYYY-MM-DD` key for a Date. */
function keyOf(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

/** Local midnight of `now`. */
function startOfDay(now: Date): Date {
	return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** `n` days offset from `base` (negative = earlier); normalizes month/DST via local midnight. */
function addDays(base: Date, n: number): Date {
	return new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
}

/** Posts-per-day, keyed by local date. Replies count (they're posts). */
export function countsByDay(posts: Post[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const p of posts) {
		const key = keyOf(new Date(p.created));
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return counts;
}

/** One day's resolved stats after backfill. `ratio` is the fill (0–1) shown in the graph. */
export interface DayStat {
	key: string;
	date: Date;
	/** Raw posts created that day. */
	count: number;
	/** Fill toward the goal after backfill (0–1). */
	ratio: number;
	/** Whether the goal was met (own posts + backfill). */
	satisfied: boolean;
	/** True if backfill lifted this day's fill above what its own posts give. */
	backfilled: boolean;
	isToday: boolean;
}

/**
 * Resolve each day from today backward, carrying a surplus "pool". A day's available
 * credit = its own count + pool (within the repair window); it consumes up to the goal
 * and passes any remainder further back. Beyond the window, days stand on their own
 * count (and don't generate carry) — bounding how much one huge day can fabricate.
 */
export function dayStats(
	counts: Map<string, number>,
	goal: number,
	now: Date,
	maxDays: number = MAX_DAYS,
): DayStat[] {
	const today = startOfDay(now);
	const out: DayStat[] = [];
	let pool = 0;

	for (let d = 0; d < maxDays; d++) {
		const date = addDays(today, -d);
		const count = counts.get(keyOf(date)) ?? 0;
		const withinWindow = d < BACKFILL_DAYS;
		const available = count + (withinWindow ? pool : 0);

		const ratio = goal > 0 ? Math.min(available, goal) / goal : count > 0 ? 1 : 0;
		const ownRatio = goal > 0 ? Math.min(count, goal) / goal : count > 0 ? 1 : 0;

		out.push({
			key: keyOf(date),
			date,
			count,
			ratio,
			satisfied: goal > 0 && available >= goal,
			backfilled: ratio > ownRatio + 1e-9,
			isToday: d === 0,
		});

		pool = withinWindow && available > goal ? available - goal : 0;
	}
	return out;
}

/** The last GRAPH_DAYS days, oldest → today (for the contribution graph). */
export function graphCells(stats: DayStat[]): DayStat[] {
	return stats.slice(0, GRAPH_DAYS).reverse();
}

/**
 * Consecutive satisfied days ending today. Grace: an unmet but in-progress today
 * doesn't break the streak — it counts from yesterday instead.
 */
export function streakLength(stats: DayStat[]): number {
	if (stats.length === 0) return 0;
	const start = stats[0].satisfied ? 0 : 1;
	let streak = 0;
	for (let d = start; d < stats.length; d++) {
		if (stats[d].satisfied) streak++;
		else break;
	}
	return streak;
}

/** Everything the widget needs, from one carry pass. */
export function computeStats(
	posts: Post[],
	goal: number,
	now: Date,
): { cells: DayStat[]; streak: number; total: number } {
	const stats = dayStats(countsByDay(posts), goal, now);
	return { cells: graphCells(stats), streak: streakLength(stats), total: posts.length };
}
