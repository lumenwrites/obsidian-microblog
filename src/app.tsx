import { Timeline } from "./components/Timeline";

/**
 * The SPA root. The view provides this app's folder + Obsidian App + settings
 * through the context provider; everything else is ordinary React.
 */
export function App() {
	return <Timeline />;
}
