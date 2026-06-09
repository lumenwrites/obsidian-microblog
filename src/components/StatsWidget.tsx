import { faFire, faSquare } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { CSSProperties, useMemo } from "react";
import { useSettings } from "../context/PluginContext";
import { computeStreak, countsByDay, graphDays, totalPosts } from "../lib/stats";
import { cn } from "../lib/utils";
import type { Post } from "../types";

/** Short date for a square's tooltip, e.g. "Jun 7". */
function formatDay(d: Date): string {
	return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Motivation widget under the composer: a 30-day contribution graph (squares fill
 * toward the daily goal), a backfilled day-streak, and the all-time post total.
 * All math is a pure transform over the already-loaded posts (see lib/stats.ts).
 */
export function StatsWidget({ posts }: { posts: Post[] }) {
	const settings = useSettings();
	const goal = settings.dailyGoal;

	const { cells, streak, total } = useMemo(() => {
		const now = new Date();
		const counts = countsByDay(posts);
		return {
			cells: graphDays(counts, goal, now),
			streak: computeStreak(counts, goal, now),
			total: totalPosts(posts),
		};
	}, [posts, goal]);

	return (
		<div className="microblog-stats">
			<div className="microblog-graph">
				{cells.map((cell) => {
					// Empty days stay blank; the first post is already pale, full at the goal.
					const fill = cell.count === 0 ? 0 : 0.25 + 0.75 * cell.ratio;
					const noun = cell.count === 1 ? "post" : "posts";
					return (
						<div
							key={cell.key}
							className={cn("microblog-graph-cell", cell.isToday && "is-today")}
							title={`${formatDay(cell.date)}: ${cell.count} ${noun}`}
							style={{ "--fill": fill } as CSSProperties}
						/>
					);
				})}
			</div>

			<div className="microblog-stat" title="Day streak">
				<FontAwesomeIcon icon={faFire} className="microblog-stat-icon is-streak" />
				<span>{streak}</span>
			</div>
			<div className="microblog-stat" title="Total posts">
				<FontAwesomeIcon icon={faSquare} className="microblog-stat-icon" />
				<span>{total}</span>
			</div>
		</div>
	);
}
