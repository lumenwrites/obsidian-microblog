import { Plugin, TFolder, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, MicroblogSettings, MicroblogSettingTab } from "./settings";
import { TimelineView, VIEW_TYPE_MICROBLOG } from "./view";

/**
 * The long-lived host. Owns settings, registers the timeline view, ribbon, command,
 * the folder context-menu entry, and the settings tab.
 *
 * State that must outlive a React mount lives HERE (on the plugin instance), not in
 * React — the view's React tree mounts/unmounts every time a tab opens/closes.
 */
export default class MicroblogPlugin extends Plugin {
	settings!: MicroblogSettings;

	/** Subscribers (the React provider) notified whenever settings are saved. */
	private settingsListeners = new Set<() => void>();

	async onload() {
		await this.loadSettings();

		// The timeline view. Multiple instances can be open at once, each bound to its
		// own folder via view state (see TimelineView.setState/getState).
		this.registerView(VIEW_TYPE_MICROBLOG, (leaf) => new TimelineView(leaf, this));

		// Ribbon + command open the default-folder timeline.
		// NOTE: native Obsidian UI uses Lucide icon names, NOT FontAwesome.
		this.addRibbonIcon("message-square", "Open microblog timeline", () => {
			void this.activateView();
		});

		this.addCommand({
			id: "open-timeline",
			name: "Open timeline",
			callback: () => void this.activateView(),
		});

		// Right-click a folder → "Open as timeline" (opens that folder in a new tab).
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (file instanceof TFolder) {
					menu.addItem((item) =>
						item
							.setTitle("Open as timeline")
							.setIcon("message-square")
							.onClick(() => void this.activateView(file.path)),
					);
				}
			}),
		);

		this.addSettingTab(new MicroblogSettingTab(this.app, this));
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<MicroblogSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.settingsListeners.forEach((cb) => cb());
	}

	/** Subscribe to settings changes (used by the React provider to re-render). */
	onSettingsChange(cb: () => void): () => void {
		this.settingsListeners.add(cb);
		return () => this.settingsListeners.delete(cb);
	}

	/** Open a timeline for `folderPath` (or the default folder), revealing an existing one. */
	async activateView(folderPath?: string): Promise<void> {
		const { workspace } = this.app;
		const path = folderPath ?? this.settings.defaultFolder;

		// Reveal an existing timeline for this folder instead of opening a duplicate tab.
		const existing = workspace
			.getLeavesOfType(VIEW_TYPE_MICROBLOG)
			.find((leaf) => (leaf.getViewState().state?.folderPath as string | undefined) === path);
		if (existing) {
			await workspace.revealLeaf(existing);
			return;
		}

		const leaf: WorkspaceLeaf = workspace.getLeaf("tab");
		await leaf.setViewState({
			type: VIEW_TYPE_MICROBLOG,
			active: true,
			state: { folderPath: path },
		});
		await workspace.revealLeaf(leaf);
	}
}
