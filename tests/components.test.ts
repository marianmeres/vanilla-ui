/**
 * Conventions lint for every single-file component in `components/`.
 *
 * The components run only in a browser (blob-URL import + import map), so their
 * behavior is verified in the gallery. What CAN be checked here, on a parsed
 * copy, is the file anatomy every component must share — the contract the
 * index, the nesting rule and the theming rely on. See docs/DESIGN.md §3.
 *
 * The style rules below are the teeth of the base-layer contract (DESIGN.md
 * §D9): a component may LAY OUT a control but never paint one, and it reads
 * colors through the base vocabulary (`--vui-surface`), never a raw design token
 * (`--vui-color-surface`) — so one idea has exactly one fallback, in one file.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { parseHTML } from "linkedom";

const dir = new URL("../components/", import.meta.url);
const pascal = (s: string) => s.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());

const files = readdirSync(dir, { withFileTypes: true })
	.filter((e) => e.isFile() && e.name.endsWith(".html"))
	.map((e) => e.name)
	.sort();

test("components/ has at least one component", () => {
	assert.ok(files.length > 0);
});

/* -------------------------------------------------------------------------
 * The base layer: components/base.css — the one place tokens are resolved and
 * controls are painted. Everything below leans on it.
 * ---------------------------------------------------------------------- */

const baseCss = readFileSync(new URL("base.css", dir), "utf8");

/** Drop /* … *\/ comments — a word in prose is not a selector or a color. */
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Drop whole `var(…)` expressions, fallbacks and all (balanced parens). */
function stripVars(css: string): string {
	let out = "", i = 0;
	for (;;) {
		const at = css.indexOf("var(", i);
		if (at < 0) return out + css.slice(i);
		out += css.slice(i, at);
		let depth = 0, j = at + 3;
		for (; j < css.length; j++) {
			if (css[j] === "(") depth++;
			else if (css[j] === ")" && --depth === 0) {
				j++;
				break;
			}
		}
		i = j;
	}
}

/** `--vui-*` names declared in base.css's `:root` — the whole vocabulary. */
const baseVocabulary: Set<string> = (() => {
	const css = stripComments(baseCss);
	const start = css.indexOf(":root");
	const open = css.indexOf("{", start);
	let depth = 0, end = open;
	for (; end < css.length; end++) {
		if (css[end] === "{") depth++;
		else if (css[end] === "}" && --depth === 0) break;
	}
	const block = css.slice(open, end);
	return new Set([...block.matchAll(/(--vui-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
})();

/**
 * The CONTEXT CHANNEL: the `--vui-control-*` names base.css READS (always with a
 * fallback, at a usage site). Deliberately not declared at `:root` — a `:root`
 * declaration substitutes its `var()`s eagerly, so a container that re-declared
 * three of the five would inherit a fourth already baked to the page's colors.
 * A component may SET these on a container; it may not set anything else.
 */
const contextChannel: Set<string> = new Set(
	[...stripComments(baseCss).matchAll(/var\(\s*(--vui-control-[a-z0-9-]+)/g)].map((m) =>
		m[1]
	),
);

/** Innermost `selector { declarations }` blocks — the declaration blocks. */
function declarationBlocks(css: string): { selector: string; body: string }[] {
	return [...stripComments(css).matchAll(/([^{}]*)\{([^{}]*)\}/g)]
		.map((m) => ({ selector: m[1].trim(), body: m[2] }));
}

/**
 * Does this selector target a control the base layer owns? The class tests are
 * anchored so a container never counts as its own control: `.vui-tabs`,
 * `.vui-tablist` and `.vui-tabs__panels` are a component's to lay out and to
 * paint, while `.vui-tab` and `[role="tab"]` are base's alone. `.vui-table` is
 * likewise a container's — the anchored `.vui-tab` test does not reach it.
 */
const paintsAControl = (selector: string) =>
	/(^|[\s,>+~(])(button|select|textarea|input|summary)\b/.test(selector) ||
	selector.includes(".vui-btn") ||
	selector.includes(".vui-input") ||
	selector.includes(".vui-menuitem") ||
	selector.includes(".vui-summary") ||
	selector.includes(".vui-switch") ||
	selector.includes(".vui-check") ||
	/\.vui-tab(?![\w-])/.test(selector) ||
	/\.vui-tablist(?![\w-])/.test(selector) ||
	/\[role[\^$*]?=["']?menuitem/.test(selector) ||
	/\[role[\^$*]?=["']?switch/.test(selector) ||
	/\[role[\^$*]?=["']?tab(list)?["']?[\s\]]/.test(selector);

/** Properties that decide how a control LOOKS — base's job, never a component's. */
const isPaint = (prop: string) =>
	/^(background|border|padding|color|font|box-shadow|outline|appearance|cursor)/
		.test(prop);

test("base.css exists and declares the cascade layer order first", () => {
	const css = stripComments(baseCss).trim();
	assert.ok(
		css.startsWith("@layer vui.base, vui.components;"),
		"base.css must OPEN with `@layer vui.base, vui.components;` — it is what " +
			"orders every component's `@layer vui.components` block after the base",
	);
	assert.ok(baseVocabulary.size > 10, "base.css :root vocabulary looks empty");
	for (
		const name of [
			"--vui-surface",
			"--vui-surface-foreground",
			"--vui-border",
			"--vui-ring",
			"--vui-radius",
			"--vui-radius-button",
			"--vui-radius-container",
			"--vui-shadow-dialog",
			"--vui-transition",
		]
	) {
		assert.ok(baseVocabulary.has(name), `base.css :root is missing ${name}`);
	}
});

test("base.css: the vocabulary is the token name minus `color-` (no -fg, no -bg)", () => {
	// design-tokens and stuic both spell `foreground`; `bg` is only ever a
	// context-channel suffix, never a vocabulary name
	for (const name of baseVocabulary) {
		assert.ok(
			!/-(fg|bg)(-|$)/.test(name),
			`${name}: spell it out (-foreground), or drop it`,
		);
	}
	// every vocabulary color resolves a token of the SAME name
	const css = stripComments(baseCss);
	for (
		const [, name, token] of css.matchAll(
			/(--vui-[a-z0-9-]+):\s*var\(\s*(--vui-color-[a-z0-9-]+)/g,
		)
	) {
		assert.deepStrictEqual(
			token,
			name.replace("--vui-", "--vui-color-"),
			`${name} should resolve ${
				name.replace("--vui-", "--vui-color-")
			}, not ${token}`,
		);
	}
});

test("base.css: the context channel is read with fallbacks, never declared at :root", () => {
	for (
		const name of [
			"--vui-control-bg",
			"--vui-control-foreground",
			"--vui-control-bg-hover",
			"--vui-control-bg-active",
			"--vui-control-border",
			"--vui-control-min-height",
			"--vui-control-py",
			"--vui-control-px",
		]
	) {
		assert.ok(contextChannel.has(name), `base.css never reads ${name}`);
	}
	for (const name of contextChannel) {
		assert.ok(
			!baseVocabulary.has(name),
			`${name} is declared at :root — its var()s would resolve there, eagerly. ` +
				`Put the default in the fallback at the usage site instead.`,
		);
	}
	const css = stripComments(baseCss);
	for (const [whole] of css.matchAll(/var\(\s*--vui-control-[a-z0-9-]+\s*\)/g)) {
		assert.ok(
			false,
			`${whole} has no fallback — a context read must carry its default`,
		);
	}
});

test("base.css is the only place a --vui-color-* design token is read", () => {
	for (const file of files) {
		const css = stripComments(readFileSync(new URL(file, dir), "utf8"));
		const raw = [...css.matchAll(/var\(\s*(--vui-color-[a-z0-9-]+)/g)].map((m) =>
			m[1]
		);
		assert.deepStrictEqual(
			raw,
			[],
			`${file} reads design tokens directly (${raw.join(", ")}) — go through ` +
				`the base vocabulary instead, so the fallback is written once`,
		);
	}
});

for (const file of files) {
	const name = file.replace(/\.html$/, "");
	const html = readFileSync(new URL(file, dir), "utf8");
	const { document } = parseHTML(html);

	test(`${file}: templates are prefixed tpl-vui-, and tpl-vui-${name} exists`, () => {
		const templates = [...document.querySelectorAll("template")];
		assert.ok(templates.length >= 1, "no <template>");
		for (const t of templates) {
			assert.ok(
				t.id.startsWith("tpl-vui-"),
				`template id "${t.id}" must start with tpl-vui-`,
			);
		}
		assert.ok(document.getElementById(`tpl-vui-${name}`), `missing #tpl-vui-${name}`);
	});

	test(`${file}: the root carries data-scope="${name}" and class vui-${name}`, () => {
		const tpl = document.getElementById(`tpl-vui-${name}`)!;
		const content = (tpl as unknown as { content?: ParentNode }).content ?? tpl;
		const root = content.firstElementChild!;
		assert.ok(root, "template has no element content");
		assert.deepStrictEqual(root.getAttribute("data-scope"), name);
		assert.ok(root.classList.contains(`vui-${name}`), `root lacks class vui-${name}`);
	});

	test(`${file}: <style> (if any) is @scope'd to .vui-${name}, in @layer vui.components`, () => {
		for (const s of document.querySelectorAll("style")) {
			const css = s.textContent ?? "";
			assert.ok(css.includes(`@scope (.vui-${name})`));
			// layered, so a consumer's own (unlayered) CSS wins without a fight
			assert.ok(css.includes("@layer vui.components"));
		}
	});

	test(`${file}: every --vui-* it reads or sets is in the base vocabulary`, () => {
		const css = stripComments(html);
		for (const [, read] of css.matchAll(/var\(\s*(--vui-[a-z0-9-]+)/g)) {
			assert.ok(
				baseVocabulary.has(read),
				`${file} reads ${read}, which components/base.css does not declare`,
			);
		}
		// the only --vui-* a component may DECLARE is a control context variable:
		// that is how a container restyles the controls inside it (its own and the
		// consumer's) without a single descendant selector
		for (const [, set] of css.matchAll(/^\s*(--vui-[a-z0-9-]+)\s*:/gm)) {
			assert.ok(
				contextChannel.has(set),
				`${file} declares ${set} — components may only set the --vui-control-* ` +
					`context channel that base.css reads`,
			);
		}
	});

	test(`${file}: no color literals outside a var() fallback`, () => {
		const css = stripVars(stripComments(html.slice(html.indexOf("<style"))));
		const literals = [
			...css.matchAll(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab)\(/gi),
		]
			.map((m) => m[0]);
		assert.deepStrictEqual(
			literals,
			[],
			`${file} hard-codes a color (${literals.join(", ")}) — put it in ` +
				`components/base.css and read it from there`,
		);
	});

	test(`${file}: lays controls out but never paints them`, () => {
		const style = html.slice(html.indexOf("<style"));
		for (const { selector, body } of declarationBlocks(style)) {
			if (!paintsAControl(selector)) continue;
			for (const decl of body.split(";")) {
				const prop = decl.split(":")[0].trim().toLowerCase();
				if (!prop || prop.startsWith("--")) continue;
				assert.ok(
					!isPaint(prop),
					`${file}: "${selector}" sets ${prop} — a control's look belongs to ` +
						`components/base.css. Set --vui-control-* on the container instead.`,
				);
			}
		}
	});

	test(`${file}: one inline module, bare vanilla import, exports create${pascal(name)}`, () => {
		const scripts = [...document.querySelectorAll('script[type="module"]')];
		assert.deepStrictEqual(scripts.length, 1, "exactly one <script type=module>");
		const src = scripts[0].textContent ?? "";
		assert.ok(src.includes('from "@marianmeres/vanilla"'));
		assert.ok(
			!/from\s+["']\.{1,2}\//.test(src),
			"relative imports can't resolve from a blob: URL",
		);
		assert.ok(src.includes(`export function create${pascal(name)}`));
		assert.ok(
			!/\.innerHTML\s*=/.test(src),
			"HTML lives in HTML — no innerHTML string building",
		);
	});
}
