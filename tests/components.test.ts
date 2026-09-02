/**
 * Conventions lint for every single-file component in `components/`.
 *
 * The components run only in a browser (blob-URL import + import map), so their
 * behavior is verified in the gallery. What CAN be checked here, on a parsed
 * copy, is the file anatomy every component must share — the contract the
 * index, the nesting rule and the theming rely on. See docs/DESIGN.md §3.
 */
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { parseHTML } from "linkedom";

const dir = new URL("../components/", import.meta.url);
const pascal = (s: string) => s.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());

const files = [...Deno.readDirSync(dir)]
	.filter((e) => e.isFile && e.name.endsWith(".html"))
	.map((e) => e.name)
	.sort();

Deno.test("components/ has at least one component", () => {
	assert(files.length > 0);
});

for (const file of files) {
	const name = file.replace(/\.html$/, "");
	const html = Deno.readTextFileSync(new URL(file, dir));
	const { document } = parseHTML(html);

	Deno.test(`${file}: templates are prefixed tpl-vui-, and tpl-vui-${name} exists`, () => {
		const templates = [...document.querySelectorAll("template")];
		assert(templates.length >= 1, "no <template>");
		for (const t of templates) {
			assert(
				t.id.startsWith("tpl-vui-"),
				`template id "${t.id}" must start with tpl-vui-`,
			);
		}
		assert(document.getElementById(`tpl-vui-${name}`), `missing #tpl-vui-${name}`);
	});

	Deno.test(`${file}: the root carries data-scope="${name}" and class vui-${name}`, () => {
		const tpl = document.getElementById(`tpl-vui-${name}`)!;
		const content = (tpl as unknown as { content?: ParentNode }).content ?? tpl;
		const root = content.firstElementChild!;
		assert(root, "template has no element content");
		assertEquals(root.getAttribute("data-scope"), name);
		assert(root.classList.contains(`vui-${name}`), `root lacks class vui-${name}`);
	});

	Deno.test(`${file}: <style> (if any) is @scope'd to .vui-${name}`, () => {
		for (const s of document.querySelectorAll("style")) {
			assertStringIncludes(s.textContent ?? "", `@scope (.vui-${name})`);
		}
	});

	Deno.test(`${file}: one inline module, bare vanilla import, exports create${pascal(name)}`, () => {
		const scripts = [...document.querySelectorAll('script[type="module"]')];
		assertEquals(scripts.length, 1, "exactly one <script type=module>");
		const src = scripts[0].textContent ?? "";
		assertStringIncludes(src, 'from "@marianmeres/vanilla"');
		assert(
			!/from\s+["']\.{1,2}\//.test(src),
			"relative imports can't resolve from a blob: URL",
		);
		assertStringIncludes(src, `export function create${pascal(name)}`);
		assert(
			!/\.innerHTML\s*=/.test(src),
			"HTML lives in HTML — no innerHTML string building",
		);
	});
}
