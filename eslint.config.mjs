import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";

// eslint-plugin-obsidianmd ships its recommended flat-config array (TS parser +
// Obsidian-API correctness rules: lifecycle/cleanup, instanceof over casting,
// no detachLeavesOfType in onunload, etc.). We spread it and add our ignores.
export default tseslint.config(
	{
		ignores: ["main.js", "node_modules/", "esbuild.config.mjs", "version-bump.mjs"],
	},
	...obsidianmd.configs.recommended,
	{
		// The recommended set includes type-aware rules — give the parser type info.
		files: ["src/**/*.{ts,tsx}"],
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
);
