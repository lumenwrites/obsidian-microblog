import { cn } from "../lib/utils";

/**
 * Circular progress indicator for the composer — fills as the post approaches the
 * soft char limit. Past the limit it turns "over" and shows the negative remainder
 * (posts can still be longer; the limit only sets the timeline's read-more fold).
 */
export function CharCountRing({ count, limit }: { count: number; limit: number }) {
	const size = 28;
	const stroke = 3;
	const r = (size - stroke) / 2;
	const circumference = 2 * Math.PI * r;
	const pct = Math.min(count / limit, 1);
	const offset = circumference * (1 - pct);
	const over = count > limit;

	return (
		<div className={cn("microblog-charcount", over && "is-over")} title={`${count} / ${limit}`}>
			<svg width={size} height={size}>
				<circle
					className="microblog-charcount-track"
					cx={size / 2}
					cy={size / 2}
					r={r}
					strokeWidth={stroke}
					fill="none"
				/>
				<circle
					className="microblog-charcount-progress"
					cx={size / 2}
					cy={size / 2}
					r={r}
					strokeWidth={stroke}
					fill="none"
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					strokeLinecap="round"
					transform={`rotate(-90 ${size / 2} ${size / 2})`}
				/>
			</svg>
			{over && <span className="microblog-charcount-label">{limit - count}</span>}
		</div>
	);
}
