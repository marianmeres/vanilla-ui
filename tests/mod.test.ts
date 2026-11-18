import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import { test } from "node:test";
import * as ui from "../src/mod.ts";

test("COMPONENTS_BASE resolves to the repo's components/ directory", () => {
	assert.ok(ui.COMPONENTS_BASE.endsWith("/components/"));
	const expected = new URL("../components/", import.meta.url).href;
	assert.deepStrictEqual(ui.COMPONENTS_BASE, expected);
});

test("componentUrl builds <base>/<name>.html", () => {
	assert.deepStrictEqual(ui.componentUrl("dialog"), ui.COMPONENTS_BASE + "dialog.html");
	assert.deepStrictEqual(
		ui.componentUrl("dialog", "https://cdn.example/kit/components/"),
		"https://cdn.example/kit/components/dialog.html",
	);
});

test("every component file the index knows about exists on disk", async () => {
	for (const name of ["dialog", "disclosure", "popover", "tabs", "toast"]) {
		const info = await stat(new URL(ui.componentUrl(name)));
		assert.ok(info.isFile(), `${name}.html missing`);
	}
});

test("baseStylesUrl points at components/base.css, which exists", async () => {
	assert.deepStrictEqual(ui.baseStylesUrl(), ui.COMPONENTS_BASE + "base.css");
	assert.deepStrictEqual(
		ui.baseStylesUrl("https://cdn.example/kit/components/"),
		"https://cdn.example/kit/components/base.css",
	);
	// every loader awaits it — a missing file would break the whole kit
	const info = await stat(new URL(ui.baseStylesUrl()));
	assert.ok(info.isFile(), "components/base.css missing");
	assert.deepStrictEqual(ui.BASE_STYLES_ID, "vui-base");
});

test("the index re-exports the base library (one import map target for both)", () => {
	for (const name of [
		"observable",
		"computed",
		"reactTo",
		"createView",
		"enhance",
		"mount",
	]) {
		assert.deepStrictEqual(
			typeof (ui as Record<string, unknown>)[name],
			"function",
			name,
		);
	}
	assert.ok(String(ui.MAX_UPDATE_DEPTH).includes("1000"));
});
