import { faCheck, faListUl, faSquare } from "@fortawesome/free-solid-svg-icons";
import type { DoneFilter } from "../types";
import { SelectControl, type SelectOption } from "./SelectControl";

const OPTIONS: Record<DoneFilter, SelectOption> = {
	all: { label: "All", icon: faListUl },
	notdone: { label: "Not done", icon: faSquare },
	done: { label: "Done", icon: faCheck },
};

const ORDER: DoneFilter[] = ["all", "notdone", "done"];

/** Toolbar control: filter the timeline by done state. */
export function FilterControl({
	filter,
	onFilter,
}: {
	filter: DoneFilter;
	onFilter: (value: DoneFilter) => void;
}) {
	return (
		<SelectControl
			value={filter}
			onChange={onFilter}
			options={OPTIONS}
			order={ORDER}
			title="Filter posts"
			align="right"
		/>
	);
}
