import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faCaretDown, faCheck } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { cn } from "../lib/utils";
import { Dropdown } from "./Dropdown";

export interface SelectOption {
	label: string;
	icon: IconDefinition;
}

/**
 * A labeled dropdown that picks one option from a set — the shared base for the
 * toolbar's sort and filter controls. The trigger shows the current option; the
 * panel lists every option with a check on the active one.
 */
export function SelectControl<T extends string>({
	value,
	onChange,
	options,
	order,
	title,
	align = "left",
}: {
	value: T;
	onChange: (value: T) => void;
	options: Record<T, SelectOption>;
	order: T[];
	title: string;
	align?: "left" | "right";
}) {
	const current = options[value];

	return (
		<Dropdown
			align={align}
			trigger={({ toggle }) => (
				<button className="microblog-sort" onClick={toggle} title={title}>
					<FontAwesomeIcon icon={current.icon} />
					<span>{current.label}</span>
					<FontAwesomeIcon icon={faCaretDown} className="microblog-sort-caret" />
				</button>
			)}
		>
			{(close) =>
				order.map((key) => {
					const opt = options[key];
					return (
						<button
							key={key}
							role="menuitemradio"
							aria-checked={key === value}
							className={cn("microblog-dropdown-item", key === value && "is-active")}
							onClick={() => {
								onChange(key);
								close();
							}}
						>
							<FontAwesomeIcon icon={opt.icon} />
							<span>{opt.label}</span>
							{key === value && (
								<FontAwesomeIcon icon={faCheck} className="microblog-dropdown-check" />
							)}
						</button>
					);
				})
			}
		</Dropdown>
	);
}
