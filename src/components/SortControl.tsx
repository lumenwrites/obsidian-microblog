import { faArrowsRotate, faClock, faTrophy } from "@fortawesome/free-solid-svg-icons";
import type { SortOrder } from "../types";
import { SelectControl, type SelectOption } from "./SelectControl";

const OPTIONS: Record<SortOrder, SelectOption> = {
	chronological: { label: "New", icon: faClock },
	score: { label: "Top", icon: faTrophy },
	resurface: { label: "Resurface", icon: faArrowsRotate },
};

const ORDER: SortOrder[] = ["chronological", "score", "resurface"];

/** Toolbar control: pick the timeline sort order. */
export function SortControl({
	sort,
	onSort,
}: {
	sort: SortOrder;
	onSort: (value: SortOrder) => void;
}) {
	return (
		<SelectControl
			value={sort}
			onChange={onSort}
			options={OPTIONS}
			order={ORDER}
			title="Sort posts"
		/>
	);
}
