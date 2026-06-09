import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
	faArrowsRotate,
	faCaretDown,
	faCheck,
	faClock,
	faTrophy,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { cn } from "../lib/utils";
import type { SortOrder } from "../types";
import { Dropdown } from "./Dropdown";

/** Sort options, each with a FontAwesome icon. */
const OPTIONS: Record<SortOrder, { label: string; icon: IconDefinition }> = {
	chronological: { label: "Newest", icon: faClock },
	score: { label: "Top", icon: faTrophy },
	resurface: { label: "Resurface", icon: faArrowsRotate },
};

const ORDER: SortOrder[] = ["chronological", "score", "resurface"];

/** A trigger that opens our custom dropdown with icon'd, checkable sort options. */
export function SortControl({
	sort,
	onSort,
}: {
	sort: SortOrder;
	onSort: (value: SortOrder) => void;
}) {
	const current = OPTIONS[sort];

	return (
		<Dropdown
			trigger={({ toggle }) => (
				<button className="microblog-sort" onClick={toggle} title="Sort posts">
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
							aria-checked={key === sort}
							className={cn("microblog-dropdown-item", key === sort && "is-active")}
							onClick={() => {
								onSort(key);
								close();
							}}
						>
							<FontAwesomeIcon icon={opt.icon} />
							<span>{opt.label}</span>
							{key === sort && (
								<FontAwesomeIcon icon={faCheck} className="microblog-dropdown-check" />
							)}
						</button>
					);
				})
			}
		</Dropdown>
	);
}
