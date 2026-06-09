import { faMagnifyingGlass, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { SortOrder } from "../types";
import { SortControl } from "./SortControl";

/** Top bar: text search (with clear) + sort order (newest / top by score). */
export function SearchSortBar({
	search,
	onSearch,
	sort,
	onSort,
}: {
	search: string;
	onSearch: (value: string) => void;
	sort: SortOrder;
	onSort: (value: SortOrder) => void;
}) {
	return (
		<div className="microblog-toolbar">
			<div className="microblog-search">
				<FontAwesomeIcon icon={faMagnifyingGlass} className="microblog-search-icon" />
				<input
					type="text"
					placeholder="Search posts…"
					value={search}
					onChange={(e) => onSearch(e.target.value)}
				/>
				{search && (
					<button
						className="microblog-search-clear"
						title="Clear search"
						onClick={() => onSearch("")}
					>
						<FontAwesomeIcon icon={faXmark} />
					</button>
				)}
			</div>
			<SortControl sort={sort} onSort={onSort} />
		</div>
	);
}
