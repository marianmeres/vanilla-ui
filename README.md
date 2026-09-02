# @marianmeres/vanilla-ui

[![JSR](https://jsr.io/badges/@marianmeres/vanilla-ui)](https://jsr.io/@marianmeres/vanilla-ui)
[![NPM](https://img.shields.io/npm/v/@marianmeres/vanilla-ui)](https://www.npmjs.com/package/@marianmeres/vanilla-ui)
[![License](https://img.shields.io/npm/l/@marianmeres/vanilla-ui)](LICENSE)

Reusable UI primitives on top of [`@marianmeres/vanilla`](https://jsr.io/@marianmeres/vanilla),
shipped as **single-file `.html` components** — a `<template>`, a `@scope`d `<style>`, and the
factory in an inline `<script type="module">` — loaded at runtime. **No build step, just
serve.** Built for vanilla-JS prototyping: mount a dialog and it looks right immediately, on
any [`design-tokens`](https://jsr.io/@marianmeres/design-tokens) theme, light or dark.

Every component leans on the platform first (native `<dialog>`, the Popover API, `<details>`)
and adds only chrome, keyboard/aria glue, and a small typed API. The rationale is in
[`docs/DESIGN.md`](./docs/DESIGN.md).

## Components

| Component | File                                                 | Built on          | Status |
| --------- | ---------------------------------------------------- | ----------------- | ------ |
| dialog    | [`components/dialog.html`](./components/dialog.html) | native `<dialog>` | ✅     |

Planned, in this order: menu/popover (Popover API), disclosure (`<details>`), tabs, toast.
See [`docs/DESIGN.md` → Roadmap](./docs/DESIGN.md#5-roadmap).

## Install

```sh
# Deno / JSR
deno add jsr:@marianmeres/vanilla-ui

# npm
npx jsr add @marianmeres/vanilla-ui
```

Or, for a prototype: **copy this repo's `components/` and `dist/` next to your page** (or
serve the repo from the same static server). The components are fetched at runtime, so the
kit must be reachable over `http://` — like any multi-file vanilla app.

## Usage

Two things on the host page: an **import map** (both bare specifiers → the one built file,
so the components and the page share a single copy of vanilla) and **one `await`**.

```html
<script type="importmap">
{
	"imports": {
		"@marianmeres/vanilla": "./vanilla-ui/dist/mod.js",
		"@marianmeres/vanilla-ui": "./vanilla-ui/dist/mod.js"
	}
}
</script>

<template id="tpl-signup">
	<form method="dialog">
		<input name="name" autofocus />
		<button value="save">Save</button>
	</form>
</template>

<script type="module">
import { fromTemplate, loadAll } from "@marianmeres/vanilla-ui";

const { createDialog } = await loadAll(); // fetches + adopts every component

const dlg = createDialog({
	title: "Sign up",
	body: fromTemplate("tpl-signup"), // text | element | view
	onClose: (returnValue) => console.log("closed:", returnValue), // "save" | "cancel" | …
});
document.body.append(dlg.el); // anywhere — the top layer handles stacking
dlg.open();
</script>
```

`loadAll()` finds the `.html` files relative to **where `mod.js` is served from**
(`../components/`), so no paths to configure. Serving them from elsewhere (a CDN, a vendored
folder)? Pass the base: `loadAll("https://cdn.example/vanilla-ui/components/")`.

Components also emit **`CustomEvent`s** on their root (`vui:close` here), so a plain listener
works too — handy when the dialog is created far from where its result is needed.

### Everything from vanilla is here too

The index re-exports the whole base library, so one import gives you `observable`,
`createView`, `enhance`, `mount`, `fromTemplate`, … alongside the loaders:

```ts
import { createView, loadAll, observable } from "@marianmeres/vanilla-ui";
```

## Theming

Components read [`@marianmeres/design-tokens`](https://jsr.io/@marianmeres/design-tokens)
variables with the prefix **`vui-`** (`--vui-color-surface`, `--vui-color-border`, …) and fall
back to **system colors** (`Canvas`, `CanvasText`, `Highlight`) when they're absent. So:

- **No theme at all** → still looks right, and follows the page's `color-scheme`.
- **A generated theme** → drop one of `gallery/themes/*.css` into the page (light on `:root`,
  dark on `:root.dark`), or generate your own: `deno task themes:build` (see
  [`gallery/themes/_generate.ts`](./gallery/themes/_generate.ts)).
- **Tokens under another prefix already?** Regenerate with `"vui-"`, or alias the handful of
  variables the components read (listed per component in [API.md](./API.md)).

No Tailwind, no utility classes in templates — the kit never assumes a page-level CSS framework.

## Nesting

Every component's root carries **`data-scope`**, vanilla's component boundary: a parent's
`refs` / `applyBindings` / `delegate` never see into a child component, so a dialog can hold
tabs that hold a menu, and shared names like `close` never collide. Do the same on your own
components' template roots when you mount them inside a kit component.

## Gallery & tests

The gallery is the kit's documentation and its visual check — every component, every state,
every theme:

```sh
deno task build   # bundles src/mod.ts -> dist/mod.js (the file the import map points at)
deno task serve   # http://localhost:4507/gallery/
```

Behavior is tested in a real browser: `deno task test:browser` serves the repo and drives
headless Chrome through `tests/browser/*.html` (one page per component). `deno task test`
covers the index and lints every component file's anatomy.

## API

See [API.md](./API.md) for the full reference (loaders, each component's props, view API,
events, and the CSS variables it reads).

## License

[MIT](LICENSE)
