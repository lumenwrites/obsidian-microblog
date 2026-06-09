import { clsx, type ClassValue } from "clsx";

/**
 * Conditional className joiner. Plain `clsx` — no `tailwind-merge`, since we use
 * hand-written CSS (scoped under `.microblog-root`), not utility classes.
 */
export function cn(...inputs: ClassValue[]): string {
	return clsx(inputs);
}
