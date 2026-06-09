import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faCaretDown, faCheck, faListUl, faSquare } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Menu } from "obsidian";
import type { MouseEvent } from "react";
import type { DoneFilter } from "../types";

/** Filter options, with a FontAwesome icon (button) and a Lucide name (menu). */
const OPTIONS: Record<DoneFilter, { label: string; icon: IconDefinition; menuIcon: string }> = {
	all: { label: "All", icon: faListUl, menuIcon: "list" },
	notdone: { label: "Not done", icon: faSquare, menuIcon: "square" },
	done: { label: "Done", icon: faCheck, menuIcon: "check" },
};

const ORDER: DoneFilter[] = ["all", "notdone", "done"];

/** A dropdown trigger that opens an Obsidian Menu to filter by done state. */
export function FilterControl({
	filter,
	onFilter,
}: {
	filter: DoneFilter;
	onFilter: (value: DoneFilter) => void;
}) {
	const current = OPTIONS[filter];

	const openMenu = (e: MouseEvent) => {
		const menu = new Menu();
		for (const key of ORDER) {
			const opt = OPTIONS[key];
			menu.addItem((item) =>
				item
					.setTitle(opt.label)
					.setIcon(opt.menuIcon)
					.setChecked(key === filter)
					.onClick(() => onFilter(key)),
			);
		}
		menu.showAtMouseEvent(e.nativeEvent);
	};

	return (
		<button className="microblog-sort" onClick={openMenu} title="Filter posts">
			<FontAwesomeIcon icon={current.icon} />
			<span>{current.label}</span>
			<FontAwesomeIcon icon={faCaretDown} className="microblog-sort-caret" />
		</button>
	);
}
