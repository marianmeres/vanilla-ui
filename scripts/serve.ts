/**
 * Static file server for the gallery: serves the repo root as is, so the gallery
 * (`/gallery/`), the browser test pages (`/tests/browser/*.html`) and a host page
 * placed next to the kit resolve `dist/mod.js` and `components/` exactly as they do
 * from any other static host.
 *
 *   pnpm run serve          # http://localhost:4507/gallery/
 *
 * `PORT` overrides the port (`PORT=0`: any free one). After touching `src/mod.ts`,
 * rebuild the bundle the pages import (`pnpm run bundle`).
 *
 * @module
 */
import process from "node:process";
import { fileURLToPath } from "node:url";
import { demino } from "@marianmeres/demino";
import { serve } from "@marianmeres/demino/node";

// `PORT=0` asks the OS for a free one (the listen line prints it)
const PORT = Number(process.env.PORT ?? 4507);

const app = demino("", [], {
	// one line per request instead of the default's full Request dump
	logger: {
		...console,
		access: ({ status, req }) =>
			console.log(`${status} ${req.method} ${new URL(req.url).pathname}`),
	},
});
app.static("/", fileURLToPath(new URL("../", import.meta.url)));

await serve(app, { port: PORT, webSockets: false });
