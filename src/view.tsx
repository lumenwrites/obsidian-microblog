import { ItemView, ViewStateResult, WorkspaceLeaf } from "obsidian";
import { StrictMode } from "react";
import { createRoot, Root } from "react-dom/client";
import { App } from "./app";
import { PluginProvider } from "./context/PluginContext";
import type MicroblogPlugin from "./main";

export const VIEW_TYPE_MICROBLOG = "microblog-timeline";

interface TimelineViewState {
	folderPath?: string;
}

/**
 * The Obsidian↔React bridge. `onOpen()` mounts the React SPA on `contentEl`;
 * `onClose()` unmounts it (critical — leaked roots are a top cause of plugin bugs).
 *
 * Each instance is bound to a folder via view state, so several timelines can be
 * open in separate tabs, each independent. The folder path is persisted/restored
 * through setState/getState and handed to React through the context provider.
 */
export class TimelineView extends ItemView {
	private root: Root | null = null;
	private folderPath: string | undefined;
	private plugin: MicroblogPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: MicroblogPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_MICROBLOG;
	}

	getDisplayText(): string {
		return this.folderPath ? `Microblog: ${this.folderPath}` : "Microblog";
	}

	getIcon(): string {
		return "message-square";
	}

	// Restore this tab's folder from persisted state, then (re-)render.
	async setState(state: TimelineViewState, result: ViewStateResult): Promise<void> {
		this.folderPath = state?.folderPath;
		await super.setState(state, result);
		this.renderApp();
	}

	getState(): Record<string, unknown> {
		return { folderPath: this.folderPath };
	}

	async onOpen(): Promise<void> {
		this.contentEl.addClass("microblog-root"); // scope all plugin CSS here
		this.root = createRoot(this.contentEl);
		this.renderApp();
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
		this.root = null;
	}

	private renderApp(): void {
		// setState can fire before onOpen creates the root; onOpen's render covers that case.
		if (!this.root) return;
		this.root.render(
			<StrictMode>
				<PluginProvider plugin={this.plugin} folderPath={this.folderPath}>
					<App />
				</PluginProvider>
			</StrictMode>,
		);
	}
}
