import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faCaretDown, faCheck, faListUl, faSquare } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { cn } from "../lib/utils";
import type { DoneFilter } from "../types";
import { Dropdown } from "./Dropdown";

/** Filter options, each with a FontAwesome icon. */
const OPTIONS: Record<DoneFilter, { label: string; icon: IconDefinition }> = {
	all: { label: "All", icon: faListUl },
	notdone: { label: "Not done", icon: faSquare },
	done: { label: "Done", icon: faCheck },
};

const ORDER: DoneFilter[] = ["all", "notdone", "done"];

/** A trigger that opens our custom dropdown to filter by done state. */
export function FilterControl({
	filter,
	onFilter,
}: {
	filter: DoneFilter;
	onFilter: (value: DoneFilter) => void;
}) {
	const current = OPTIONS[filter];

	return (
		<Dropdown
			align="right"
			trigger={({ toggle }) => (
				<button className="microblog-sort" onClick={toggle} title="Filter posts">
					<FontAwesomeIcon icon={current.icon} />
					<span>{current.label}</span>
					<FontAwesomeIcon icon={faCaretDown} className="microblog-sort-caret" />
				</button>
			)}
		>
			{(close) =>
				ORDER.map((key) => {
					const opt = OPTIONS[key];
					return (
						<button
							key={key}
							role="menuitemradio"
							aria-checked={key === filter}
							className={cn("microblog-dropdown-item", key === filter && "is-active")}
							onClick={() => {
								onFilter(key);
								close();
							}}
						>
							<FontAwesomeIcon icon={opt.icon} />
							<span>{opt.label}</span>
							{key === filter && (
								<FontAwesomeIcon icon={faCheck} className="microblog-dropdown-check" />
							)}
						</button>
					);
				})
			}
		</Dropdown>
	);
}
