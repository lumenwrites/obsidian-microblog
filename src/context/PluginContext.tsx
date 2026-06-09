import type { App as ObsidianApp } from "obsidian";
import { createContext, ReactNode, useContext } from "react";
import type MicroblogPlugin from "../main";
import type { MicroblogSettings } from "../settings";

/**
 * One provider exposes the plugin (and through it the Obsidian App + live settings)
 * plus this view's folder path to the whole React tree. Components reach them via the
 * hooks below instead of prop-drilling — the official Obsidian context pattern,
 * generalized to also carry the plugin, settings, and per-view folder.
 */
interface PluginContextValue {
	plugin: MicroblogPlugin;
	folderPath: string | undefined;
}

const PluginContext = createContext<PluginContextValue | undefined>(undefined);

export function PluginProvider({
	plugin,
	folderPath,
	children,
}: {
	plugin: MicroblogPlugin;
	folderPath: string | undefined;
	children: ReactNode;
}) {
	return (
		<PluginContext.Provider value={{ plugin, folderPath }}>
			{children}
		</PluginContext.Provider>
	);
}

function usePluginContext(): PluginContextValue {
	const ctx = useContext(PluginContext);
	if (!ctx) {
		throw new Error("Microblog hooks must be used within <PluginProvider>.");
	}
	return ctx;
}

export const usePlugin = (): MicroblogPlugin => usePluginContext().plugin;
export const useApp = (): ObsidianApp => usePluginContext().plugin.app;
export const useSettings = (): MicroblogSettings => usePluginContext().plugin.settings;
export const useFolderPath = (): string | undefined => usePluginContext().folderPath;
