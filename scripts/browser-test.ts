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
 * Requires Chrome. Path from `$CHROME`, else the macOS default.
 *
 *   deno task test:browser
 */
import { serveDir } from "@std/http/file-server";

const CHROME = Deno.env.get("CHROME") ??
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const TIMEOUT_MS = 20_000;
const root = new URL("../", import.meta.url);
const pagesDir = new URL("tests/browser/", root);

const pages = [...Deno.readDirSync(pagesDir)]
	.filter((e) => e.isFile && e.name.endsWith(".html"))
	.map((e) => e.name)
	.sort();
if (!pages.length) {
	console.error("no tests/browser/*.html pages");
	Deno.exit(1);
}

// -- static server for the repo root (components are fetched at runtime)
const server = Deno.serve(
	{ port: 0, onListen: () => {} },
	(req) => serveDir(req, { fsRoot: root.pathname, quiet: true }),
);
const origin = `http://localhost:${(server.addr as Deno.NetAddr).port}`;

// -- headless chrome with the devtools endpoint
const profile = await Deno.makeTempDir({ prefix: "vui-chrome-" });
const chrome = new Deno.Command(CHROME, {
	args: [
		"--headless=new",
		"--disable-gpu",
		"--no-first-run",
		"--no-default-browser-check",
		`--user-data-dir=${profile}`,
		`--remote-debugging-port=${PORT}`,
		"about:blank",
	],
	stdout: "null",
	stderr: "null",
}).spawn();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failed = 0;

try {
	let targets: { webSocketDebuggerUrl: string; type: string }[] = [];
	for (let i = 0; i < 100 && !targets.some((t) => t.type === "page"); i++) {
		try {
			targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
		} catch { /* not up yet */ }
		await sleep(100);
	}
	const page = targets.find((t) => t.type === "page");
	if (!page) throw new Error("Chrome did not expose a page target");

	const ws = new WebSocket(page.webSocketDebuggerUrl);
	await new Promise((r) => (ws.onopen = r));
	let id = 0;
	const pending = new Map<number, (v: unknown) => void>();
	let problems: string[] = [];
	ws.onmessage = (ev) => {
		const msg = JSON.parse(ev.data);
		if (msg.id && pending.has(msg.id)) {
			pending.get(msg.id)!(msg.result);
			pending.delete(msg.id);
		} else if (msg.method === "Runtime.exceptionThrown") {
			problems.push(
				`[exception] ${
					msg.params.exceptionDetails.exception?.description ??
						msg.params.exceptionDetails.text
				}`,
			);
		} else if (
			msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error"
		) {
			problems.push(
				`[console.error] ${
					msg.params.args.map((a: { value?: unknown; description?: string }) =>
						a.value ?? a.description
					).join(" ")
				}`,
			);
		} else if (
			msg.method === "Log.entryAdded" && msg.params.entry.level === "error"
		) {
			problems.push(
				`[${msg.params.entry.source}] ${msg.params.entry.text} ${
					msg.params.entry.url ?? ""
				}`,
			);
		}
	};
	const send = (method: string, params: Record<string, unknown> = {}) =>
		new Promise<unknown>((resolve) => {
			const mid = ++id;
			pending.set(mid, resolve);
			ws.send(JSON.stringify({ id: mid, method, params }));
		});
	await send("Runtime.enable");
	await send("Log.enable");
	await send("Page.enable");

	for (const file of pages) {
		problems = [];
		await send("Page.navigate", { url: `${origin}/tests/browser/${file}` });
		let text = "";
		const deadline = Date.now() + TIMEOUT_MS;
		while (Date.now() < deadline) {
			const res = (await send("Runtime.evaluate", {
				expression: 'document.getElementById("result")?.textContent ?? ""',
				returnByValue: true,
			})) as { result?: { value?: unknown } };
			text = String(res?.result?.value ?? "");
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
	ws.close();
} finally {
	chrome.kill("SIGKILL");
	await chrome.status;
	await Deno.remove(profile, { recursive: true }).catch(() => {});
	await server.shutdown();
}

Deno.exit(failed ? 1 : 0);
