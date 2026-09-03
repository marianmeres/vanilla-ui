/**
 * Browser tests: run every `tests/browser/*.html` page in headless Chrome.
 *
 * Component behavior needs a real browser (blob-URL import through an import
 * map, native <dialog> semantics), so each page under `tests/browser/` is a
 * self-contained script that exercises a component and reports into
 * `<pre id="result">` — one line per check, `ok <name>` / `FAIL <name>`, and a
 * final `DONE`. This driver serves the repo, drives Chrome over the DevTools
 * protocol, polls the result, and fails the process on any FAIL, uncaught
 * exception, console error, or timeout.
 *
 * The browser plumbing itself is `scripts/_chrome.ts`, shared with
 * `scripts/render-fingerprint.ts`.
 *
 * Requires Chrome. Path from `$CHROME`, else the macOS default.
 *
 *   deno task test:browser
 */
import { withChrome } from "./_chrome.ts";

const TIMEOUT_MS = 20_000;
const pagesDir = new URL("../tests/browser/", import.meta.url);

const pages = [...Deno.readDirSync(pagesDir)]
	.filter((e) => e.isFile && e.name.endsWith(".html"))
	.map((e) => e.name)
	.sort();
if (!pages.length) {
	console.error("no tests/browser/*.html pages");
	Deno.exit(1);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const failed = await withChrome(async ({ navigate, evaluate, problems }) => {
	let failed = 0;
	for (const file of pages) {
		problems.length = 0; // errors are attributed to the page that raised them
		await navigate(`tests/browser/${file}`);
		let text = "";
		const deadline = Date.now() + TIMEOUT_MS;
		while (Date.now() < deadline) {
			text = String(
				await evaluate('document.getElementById("result")?.textContent ?? ""') ??
					"",
			);
			if (/^(DONE|ERROR)/m.test(text)) break;
			await sleep(50);
		}
		const lines = text.split("\n").filter(Boolean);
		const fails = lines.filter((l) => /^(FAIL|ERROR)/.test(l));
		const done = lines.includes("DONE");
		const ok = done && !fails.length && !problems.length;
		if (!ok) failed++;
		console.log(
			`${ok ? "ok" : "FAIL"}  ${file}  (${
				lines.filter((l) => l.startsWith("ok ")).length
			} checks)`,
		);
		if (!ok) {
			for (const l of lines) console.log("    " + l);
			if (!done) console.log("    (no DONE within timeout)");
			for (const p of problems) console.log("    " + p);
		}
	}
	return failed;
}, { port: 9333 });

Deno.exit(failed ? 1 : 0);
