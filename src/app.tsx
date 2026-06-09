import { faComments } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useApp, useFolderPath, useSettings } from "./context/PluginContext";

/**
 * The SPA root. Currently a smoke screen that proves the whole chain works:
 * React is mounted, themed by Obsidian's CSS variables, and reaches the Obsidian
 * App + live settings + this view's folder through the context hooks.
 *
 * The real timeline (search/sort bar → post list → composer) replaces this body.
 */
export function App() {
	const app = useApp();
	const settings = useSettings();
	const folderPath = useFolderPath();

	return (
		<div className="microblog-app">
			<header className="microblog-header">
				<FontAwesomeIcon icon={faComments} className="microblog-header-icon" />
				<h2>Microblog</h2>
			</header>

			<div className="microblog-panel">
				<p>The React app is mounted and wired to Obsidian.</p>
				<ul className="microblog-facts">
					<li>
						Vault: <strong>{app.vault.getName()}</strong>
					</li>
					<li>
						Folder: <strong>{folderPath ?? settings.defaultFolder}</strong>
					</li>
					<li>
						Read-more limit: <strong>{settings.charLimit}</strong> chars
					</li>
				</ul>
			</div>
		</div>
	);
}
