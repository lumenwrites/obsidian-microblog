import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../lib/utils";

/**
 * A small custom dropdown: a trigger button plus a panel that hangs from it.
 * Replaces Obsidian's `Menu` for in-view controls so we fully control the look
 * (matching the post ⋯ menu) and sizing on touch.
 *
 * Closes on outside-click (pointerdown) or Escape. Uses `activeDocument` so the
 * listeners work in Obsidian popout windows too.
 *
 * `trigger` renders the button (receives `open` + `toggle`); `children` renders the
 * panel rows (receives `close`, to dismiss after a selection). `align` picks the
 * edge the panel hangs from — "right" for controls near the pane's right edge so
 * the panel doesn't overflow.
 */
export function Dropdown({
	trigger,
	children,
	align = "left",
}: {
	trigger: (state: { open: boolean; toggle: () => void }) => ReactNode;
	children: (close: () => void) => ReactNode;
	align?: "left" | "right";
}) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const onPointerDown = (e: PointerEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
		};
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		activeDocument.addEventListener("pointerdown", onPointerDown);
		activeDocument.addEventListener("keydown", onKeyDown);
		return () => {
			activeDocument.removeEventListener("pointerdown", onPointerDown);
			activeDocument.removeEventListener("keydown", onKeyDown);
		};
	}, [open]);

	return (
		<div className="microblog-dropdown" ref={ref}>
			{trigger({ open, toggle: () => setOpen((v) => !v) })}
			{open && (
				<div
					className={cn("microblog-dropdown-panel", align === "right" && "is-right")}
					role="menu"
				>
					{children(() => setOpen(false))}
				</div>
			)}
		</div>
	);
}
