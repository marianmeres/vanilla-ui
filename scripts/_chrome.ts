/**
 * The headless-Chrome harness both browser-facing scripts sit on.
 *
 * The kit can only really be checked in a browser — `loadComponent` imports a
 * component's inline module from a `blob:` URL through the host's import map,
 * `<dialog>` and the Popover API are the platform's, and "does it look right"
 * is a question about layout. So `scripts/browser-test.ts` (behavior) and
 * `scripts/render-fingerprint.ts` (rendering) both need the same five things:
 * serve the repo, launch Chrome, talk DevTools to it, collect page errors, and
 * tear it all down. That is this file, and nothing else — it knows nothing
 * about tests, fingerprints, or the gallery.
 *
 * Requires Chrome. Path from `$CHROME`, else the macOS default.
 */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { demino } from "@marianmeres/demino";
import { serve } from "@marianmeres/demino/node";

const CHROME =
	process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/** What a DevTools call resolves to — a result object, or nothing. */
type CdpResult = Record<string, unknown> | undefined;

/** A live page, served from the repo root and driven over the DevTools protocol. */
export interface ChromeSession {
	/** Where the repo root is being served — `navigate` resolves against it. */
	origin: string;
	/** Raw DevTools call. */
	send(method: string, params?: Record<string, unknown>): Promise<CdpResult>;
	/** Go to a repo-relative path (`"gallery/"`, `"tests/browser/tabs.html"`). */
	navigate(path: string): Promise<void>;
	/** Evaluate an expression in the page and return its value (promises awaited). */
	evaluate<T = unknown>(expression: string): Promise<T>;
	/**
	 * Uncaught exceptions, `console.error`s and error-level log entries seen so
	 * far. Mutable on purpose: a caller driving several pages empties it between
	 * them (`problems.length = 0`).
	 */
	problems: string[];
}

/** Options for {@link withChrome}. */
export interface ChromeOptions {
	/**
	 * DevTools port. Default: whichever one the OS hands Chrome, so any number of
	 * runs can overlap; `$CHROME_DEBUG_PORT` pins it, for debugging only.
	 */
	port?: number;
	/** Fix the viewport — geometry is only comparable at a known size. */
	viewport?: { width: number; height: number; deviceScaleFactor?: number };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Serve the repo, open one headless page, hand it to `fn`, and clean up
 * whatever happens — the browser, its throwaway profile and the server.
 */
export async function withChrome<T>(
	fn: (session: ChromeSession) => Promise<T>,
	opts: ChromeOptions = {},
): Promise<T> {
	const port = opts.port ?? Number(process.env.CHROME_DEBUG_PORT ?? 0);
	const app = demino("", [], { logger: null });
	app.static("/", fileURLToPath(new URL("../", import.meta.url)));
	const server = await serve(app, { port: 0, onListen: () => {}, webSockets: false });
	const origin = `http://localhost:${server.port}`;
	// a fresh profile every run: no carried-over localStorage (the gallery
	// remembers its theme), so a measured page is the same page every time
	const profile = await mkdtemp(join(tmpdir(), "vui-chrome-"));
	const chrome = spawn(
		CHROME,
		[
			"--headless=new",
			"--disable-gpu",
			"--no-first-run",
			"--no-default-browser-check",
			`--user-data-dir=${profile}`,
			`--remote-debugging-port=${port}`,
			"about:blank",
		],
		{ stdio: "ignore" },
	);
	// Node reports a missing binary as an event, not a throw: keep it for the
	// error below, and let the teardown wait on whichever of the two comes first
	let spawnError: Error | undefined;
	const exited = new Promise<void>((resolve) => {
		chrome.once("exit", () => resolve());
		chrome.once("error", (e) => {
			spawnError = e;
			resolve();
		});
	});

	try {
		let targets: { webSocketDebuggerUrl: string; type: string }[] = [];
		// the port Chrome bound. Asked for 0, it writes the one it got to the
		// profile's DevToolsActivePort (first line), the only way to learn it; a
		// pinned port gets no such file, and needs none
		let devtools = port;
		for (
			let i = 0;
			i < 100 && !spawnError && !targets.some((t) => t.type === "page");
			i++
		) {
			try {
				devtools ||= Number(
					(await readFile(join(profile, "DevToolsActivePort"), "utf8")).split(
						"\n",
					)[0],
				);
				if (devtools) {
					targets = await (
						await fetch(`http://127.0.0.1:${devtools}/json`)
					).json();
				}
			} catch {
				/* not up yet */
			}
			await sleep(100);
		}
		const page = targets.find((t) => t.type === "page");
		if (!page) {
			throw spawnError
				? new Error(`cannot start Chrome at ${CHROME} (set $CHROME)`, {
						cause: spawnError,
					})
				: new Error("Chrome did not expose a page target");
		}

		const ws = new WebSocket(page.webSocketDebuggerUrl);
		await new Promise((r) => (ws.onopen = r));
		let id = 0;
		const pending = new Map<number, (v: CdpResult) => void>();
		const problems: string[] = [];
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
				msg.method === "Runtime.consoleAPICalled" &&
				msg.params.type === "error"
			) {
				problems.push(
					`[console.error] ${msg.params.args
						.map(
							(a: { value?: unknown; description?: string }) =>
								a.value ?? a.description,
						)
						.join(" ")}`,
				);
			} else if (
				msg.method === "Log.entryAdded" &&
				msg.params.entry.level === "error"
			) {
				problems.push(
					`[${msg.params.entry.source}] ${msg.params.entry.text} ${
						msg.params.entry.url ?? ""
					}`,
				);
			}
		};
		const send = (method: string, params: Record<string, unknown> = {}) =>
			new Promise<CdpResult>((resolve) => {
				const mid = ++id;
				pending.set(mid, resolve);
				ws.send(JSON.stringify({ id: mid, method, params }));
			});

		await send("Runtime.enable");
		await send("Log.enable");
		await send("Page.enable");
		if (opts.viewport) {
			await send("Emulation.setDeviceMetricsOverride", {
				...opts.viewport,
				deviceScaleFactor: opts.viewport.deviceScaleFactor ?? 1,
				mobile: false,
			});
		}

		const session: ChromeSession = {
			origin,
			send,
			problems,
			navigate: async (path) => {
				await send("Page.navigate", { url: new URL(path, `${origin}/`).href });
			},
			evaluate: async <T>(expression: string) => {
				const res = (await send("Runtime.evaluate", {
					expression,
					returnByValue: true,
					awaitPromise: true,
				})) as { result?: { value?: unknown } } | undefined;
				return res?.result?.value as T;
			},
		};

		const out = await fn(session);
		ws.close();
		return out;
	} finally {
		chrome.kill("SIGKILL");
		await exited;
		await rm(profile, { recursive: true, force: true }).catch(() => {});
		await server.shutdown();
	}
}
