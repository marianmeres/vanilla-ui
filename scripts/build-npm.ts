import { npmBuild, versionizeDeps } from "@marianmeres/npmbuild";

const denoJson = JSON.parse(Deno.readTextFileSync("deno.json"));

await npmBuild({
	name: denoJson.name,
	version: denoJson.version,
	repository: denoJson.name.replace(/^@/, ""),
	dependencies: versionizeDeps(["@marianmeres/vanilla"], denoJson),
	// `components/` must ship: the built index resolves them as `../components/`
	// relative to itself (node_modules/@marianmeres/vanilla-ui/dist/mod.js).
	rootFiles: [
		"LICENSE",
		"README.md",
		"API.md",
		"AGENTS.md",
		"CLAUDE.md",
		"docs",
		"components",
	],
});
