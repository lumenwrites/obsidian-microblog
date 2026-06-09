import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faCaretDown, faClock, faTrophy } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Menu } from "obsidian";
import type { MouseEvent } from "react";
import type { SortOrder } from "../types";

/** Sort options, with both a FontAwesome icon (button) and a Lucide name (menu). */
const OPTIONS: Record<SortOrder, { label: string; icon: IconDefinition; menuIcon: string }> = {
	chronological: { label: "Newest", icon: faClock, menuIcon: "clock" },
	score: { label: "Top", icon: faTrophy, menuIcon: "trophy" },
};

const ORDER: SortOrder[] = ["chronological", "score"];

/** A dropdown trigger that opens an Obsidian Menu with icon'd, checkable options. */
export function SortControl({
	sort,
	onSort,
}: {
	sort: SortOrder;
	onSort: (value: SortOrder) => void;
}) {
	const current = OPTIONS[sort];

	const openMenu = (e: MouseEvent) => {
		const menu = new Menu();
		for (const key of ORDER) {
			const opt = OPTIONS[key];
			menu.addItem((item) =>
				item
					.setTitle(opt.label)
					.setIcon(opt.menuIcon)
					.setChecked(key === sort)
					.onClick(() => onSort(key)),
			);
		}
		menu.showAtMouseEvent(e.nativeEvent);
	};

	return (
		<button className="microblog-sort" onClick={openMenu} title="Sort posts">
			<FontAwesomeIcon icon={current.icon} />
			<span>{current.label}</span>
			<FontAwesomeIcon icon={faCaretDown} className="microblog-sort-caret" />
		</button>
	);
}
