import type { Post } from "../types";

/**
 * Pure stats math for the streak widget. Days are local (boundary = local midnight).
 * All functions take `now` so they're deterministic and testable.
 */

/** Recent days whose gaps surplus posts may backfill (streak repair window). */
export const BACKFILL_DAYS = 14;

/** Days shown in the contribution graph. */
export const GRAPH_DAYS = 30;

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

/** One day in the contribution graph. `ratio` = raw progress toward the goal (0–1). */
export interface DayCell {
	key: string;
	date: Date;
	count: number;
	ratio: number;
	isToday: boolean;
}

/** The last GRAPH_DAYS days, oldest → today. Squares reflect *raw* daily counts. */
export function graphDays(counts: Map<string, number>, goal: number, now: Date): DayCell[] {
	const today = startOfDay(now);
	const cells: DayCell[] = [];
	for (let i = GRAPH_DAYS - 1; i >= 0; i--) {
		const date = addDays(today, -i);
		const count = counts.get(keyOf(date)) ?? 0;
		const ratio = goal > 0 ? Math.min(count / goal, 1) : count > 0 ? 1 : 0;
		cells.push({ key: keyOf(date), date, count, ratio, isToday: i === 0 });
	}
	return cells;
}

/**
 * Consecutive days the goal was met, ending today — with backfill: surplus posts
 * (beyond the goal) flow backward to repair gaps within the last BACKFILL_DAYS.
 *
 * Walk from today backward carrying a surplus "pool"; a day is satisfied if its own
 * count plus the pool meets the goal. Backfill (using/creating pool) is only applied
 * within the repair window — beyond it, days must stand on their own count, which
 * bounds how much one huge day can fabricate. Today gets grace: if it isn't met yet
 * (in progress), the streak counts from yesterday so it doesn't break mid-day.
 */
export function computeStreak(counts: Map<string, number>, goal: number, now: Date): number {
	if (goal <= 0) return 0;
	const today = startOfDay(now);
	const MAX_DAYS = 400; // safety bound on history scanned

	const satisfied: boolean[] = [];
	let pool = 0;
	for (let d = 0; d < MAX_DAYS; d++) {
		const count = counts.get(keyOf(addDays(today, -d))) ?? 0;
		const withinWindow = d < BACKFILL_DAYS;
		const available = count + (withinWindow ? pool : 0);
		if (available >= goal) {
			satisfied[d] = true;
			pool = withinWindow ? available - goal : 0;
		} else {
			satisfied[d] = false;
			pool = 0;
		}
	}

	// Grace: an unmet but in-progress today doesn't break the streak — start at yesterday.
	const start = satisfied[0] ? 0 : 1;
	let streak = 0;
	for (let d = start; d < MAX_DAYS; d++) {
		if (satisfied[d]) streak++;
		else break;
	}
	return streak;
}

/** All-time post count for this folder. */
export function totalPosts(posts: Post[]): number {
	return posts.length;
}
