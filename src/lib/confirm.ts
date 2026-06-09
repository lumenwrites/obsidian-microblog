import { App, Modal, Setting } from "obsidian";

/**
 * Promise-based confirmation dialog built on Obsidian's `Modal`.
 * Resolves `true` only if the user clicks the confirm button; `false` on cancel,
 * Esc, or clicking outside.
 */
export function confirm(
	app: App,
	opts: { title: string; message: string; cta?: string; danger?: boolean },
): Promise<boolean> {
	return new Promise((resolve) => {
		const modal = new Modal(app);
		modal.setTitle(opts.title);
		modal.contentEl.createEl("p", { text: opts.message });

		let confirmed = false;
		new Setting(modal.contentEl)
			.addButton((b) => b.setButtonText("Cancel").onClick(() => modal.close()))
			.addButton((b) => {
				b.setButtonText(opts.cta ?? "Confirm").onClick(() => {
					confirmed = true;
					modal.close();
				});
				// setDestructive() is the modern equivalent but requires Obsidian 1.13.0;
				// setWarning() is the only destructive style available at our minAppVersion.
				// eslint-disable-next-line @typescript-eslint/no-deprecated
				if (opts.danger) b.setWarning();
			});

		modal.onClose = () => resolve(confirmed);
		modal.open();
	});
}
