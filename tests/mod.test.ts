import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import * as ui from "../src/mod.ts";

Deno.test("COMPONENTS_BASE resolves to the repo's components/ directory", () => {
	assert(ui.COMPONENTS_BASE.endsWith("/components/"));
	const expected = new URL("../components/", import.meta.url).href;
	assertEquals(ui.COMPONENTS_BASE, expected);
});

Deno.test("componentUrl builds <base>/<name>.html", () => {
	assertEquals(ui.componentUrl("dialog"), ui.COMPONENTS_BASE + "dialog.html");
	assertEquals(
		ui.componentUrl("dialog", "https://cdn.example/kit/components/"),
		"https://cdn.example/kit/components/dialog.html",
	);
});

Deno.test("every component file the index knows about exists on disk", async () => {
	for (const name of ["dialog", "disclosure", "popover", "tabs"]) {
		const stat = await Deno.stat(new URL(ui.componentUrl(name)));
		assert(stat.isFile, `${name}.html missing`);
	}
});

Deno.test("baseStylesUrl points at components/base.css, which exists", async () => {
	assertEquals(ui.baseStylesUrl(), ui.COMPONENTS_BASE + "base.css");
	assertEquals(
		ui.baseStylesUrl("https://cdn.example/kit/components/"),
		"https://cdn.example/kit/components/base.css",
	);
	// every loader awaits it — a missing file would break the whole kit
	const stat = await Deno.stat(new URL(ui.baseStylesUrl()));
	assert(stat.isFile, "components/base.css missing");
	assertEquals(ui.BASE_STYLES_ID, "vui-base");
});

Deno.test("the index re-exports the base library (one import map target for both)", () => {
	for (
		const name of [
			"observable",
			"computed",
			"reactTo",
			"createView",
			"enhance",
			"mount",
		]
	) {
		assertEquals(typeof (ui as Record<string, unknown>)[name], "function", name);
	}
	assertStringIncludes(String(ui.MAX_UPDATE_DEPTH), "1000");
});
