/**
 * Render fingerprint: prove a change altered nothing on screen.
 *
 * Some changes are supposed to be invisible — a reformat, a selector rewritten
 * to mean the same thing, a refactor of the base layer. "It still looks right"
 * is not a claim a diff can settle and not one the browser tests cover: they
 * check behavior, not layout. So this loads a page in headless Chrome and
 * writes down what it actually rendered — the body's text, and every element's
 * tag, class and bounding box to a tenth of a pixel — then compares two of
 * those.
 *
 *   deno task fingerprint                    # capture the baseline
 *   …change something…
 *   deno task fingerprint --check            # identical, or a diff and exit 1
 *
 * The baseline lands in `tmp/` (gitignored) on purpose: it is a before/after
 * pair within one piece of work, not a committed snapshot that would need
 * regenerating every time the gallery legitimately changes.
 *
 * Options:
 *   <file>              where the fingerprint goes  [tmp/render-fingerprint.json]
 *   --check             compare against <file> instead of writing it
 *   --page <path>       repo-relative page to measure               [gallery/]
 *   --click <selector>  click before measuring, repeatable — for chrome that
 *                       only exists on demand (a dialog, a popover). Defaults
 *                       to the gallery's own triggers; pass --page and these
 *                       are dropped, since they mean nothing elsewhere.
 *
 * It is only useful because it is deterministic: a fresh browser profile every
 * run (so the gallery's remembered theme cannot leak between them), a fixed
 * viewport, and a settle delay past the kit's longest transition.
 *
 * Requires Chrome. Path from `$CHROME`, else the macOS default.
 */
import { dirname } from "@std/path";
import { withChrome } from "./_chrome.ts";

/** Chrome that only exists after a click — measured too, or it is not measured at all. */
const GALLERY_CLICKS = [
	'#dialog [data-on="click:form"]', // a modal, with a form in its body
	'#popover [data-ref="menuBtn"]', // a menu in the top layer
];
const DEFAULT_OUT = new URL("../tmp/render-fingerprint.json", import.meta.url);

const args = [...Deno.args];
const flag = (name: string) => {
	const at = args.indexOf(name);
	if (at < 0) return undefined;
	return args.splice(at, 2)[1];
};
const flagAll = (name: string) => {
	const out: string[] = [];
	for (let v = flag(name); v !== undefined; v = flag(name)) out.push(v);
	return out;
};

const check = args.includes("--check");
const page = flag("--page");
const clicks = flagAll("--click");
const out = args.filter((a) => !a.startsWith("--"))[0] ?? DEFAULT_OUT.pathname;

const fingerprint = await withChrome(async ({ navigate, evaluate, problems }) => {
	await navigate(page ?? "gallery/");
	// the kit loads its components over the network and animates on entry;
	// well past both, and past --vui-transition, before anything is measured
	await new Promise((r) => setTimeout(r, 3000));
	for (const selector of clicks.length ? clicks : page ? [] : GALLERY_CLICKS) {
		await evaluate(
			`document.querySelector(${JSON.stringify(selector)})?.click() ?? null`,
		);
		await new Promise((r) => setTimeout(r, 500));
	}
	if (problems.length) {
		console.error("page errors:\n  " + problems.join("\n  "));
		Deno.exit(1);
	}
	// `.wrap *` is the page; the top-layer boxes sit outside it, so they are
	// named separately or they would go unmeasured
	return await evaluate<string>(`JSON.stringify({
		text: document.body.innerText,
		topLayer: [...document.querySelectorAll("dialog[open], [popover]")]
			.map((el) => el.innerText).join("\\n----\\n"),
		boxes: [...document.querySelectorAll(".wrap *, dialog[open] *, [popover] *")]
			.map((el) => {
				const b = el.getBoundingClientRect();
				return [
					el.tagName,
					typeof el.className === "string" ? el.className : "",
					Math.round(b.x * 10) / 10,
					Math.round(b.y * 10) / 10,
					Math.round(b.width * 10) / 10,
					Math.round(b.height * 10) / 10,
				].join("|");
			}),
	}, null, 1)`);
}, { port: 9466, viewport: { width: 1000, height: 1400 } });

if (!check) {
	// tmp/ is gitignored, so on a fresh clone it may not exist yet
	await Deno.mkdir(dirname(out), { recursive: true });
	await Deno.writeTextFile(out, fingerprint);
	const { boxes } = JSON.parse(fingerprint);
	console.log(`captured ${boxes.length} boxes → ${out}`);
	Deno.exit(0);
}

let baseline: string;
try {
	baseline = await Deno.readTextFile(out);
} catch {
	console.error(`no baseline at ${out} — run \`deno task fingerprint\` first`);
	Deno.exit(1);
}
if (baseline === fingerprint) {
	const { boxes } = JSON.parse(fingerprint);
	console.log(`unchanged — ${boxes.length} boxes identical to ${out}`);
	Deno.exit(0);
}

// something moved: say what, rather than dumping two files at the reader
const was = JSON.parse(baseline), now = JSON.parse(fingerprint);
if (was.text !== now.text) console.log("body text CHANGED");
if (was.topLayer !== now.topLayer) console.log("top-layer text CHANGED");
if (was.boxes.length !== now.boxes.length) {
	console.log(`box count ${was.boxes.length} -> ${now.boxes.length}`);
}
let shown = 0;
for (let i = 0; i < Math.max(was.boxes.length, now.boxes.length); i++) {
	if (was.boxes[i] === now.boxes[i]) continue;
	if (++shown > 20) {
		console.log("  …");
		break;
	}
	console.log(`  - ${was.boxes[i] ?? "(none)"}\n  + ${now.boxes[i] ?? "(none)"}`);
}
Deno.exit(1);
