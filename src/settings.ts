import { App, PluginSettingTab, Setting } from "obsidian";
import type MicroblogPlugin from "./main";

export interface MicroblogSettings {
	/** Folder opened as a timeline when no specific folder is given (ribbon/command). */
	defaultFolder: string;
	/** Soft character limit — posts longer than this fold behind a "read more" toggle. */
	charLimit: number;
	/** Put the composer above the search bar and order posts newest/top-first. */
	composerOnTop: boolean;
}

export const DEFAULT_SETTINGS: MicroblogSettings = {
	defaultFolder: "microblog",
	charLimit: 300,
	composerOnTop: false,
};

export class MicroblogSettingTab extends PluginSettingTab {
	private plugin: MicroblogPlugin;

	constructor(app: App, plugin: MicroblogPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Default folder")
			.setDesc("Folder opened as a timeline from the ribbon icon or command.")
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.defaultFolder)
					.setValue(this.plugin.settings.defaultFolder)
					.onChange(async (value) => {
						this.plugin.settings.defaultFolder = value.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Read-more character limit")
			.setDesc('Posts longer than this fold behind a "read more" toggle in the timeline.')
			.addText((text) =>
				text
					.setValue(String(this.plugin.settings.charLimit))
					.onChange(async (value) => {
						const n = Number(value);
						this.plugin.settings.charLimit =
							Number.isFinite(n) && n > 0 ? n : DEFAULT_SETTINGS.charLimit;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Composer at top")
			.setDesc(
				"Show the post box above the search bar, with the newest (or top-scoring) posts first.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.composerOnTop)
					.onChange(async (value) => {
						this.plugin.settings.composerOnTop = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
