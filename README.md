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
and adds only chrome, keyboard/aria glue, and a small typed API. Underneath them all sits one
small **base layer** (`components/base.css`) holding the token vocabulary and the control
primitives — buttons, inputs, the focus ring — so nothing in the kit can drift apart. The
rationale is in [`docs/DESIGN.md`](./docs/DESIGN.md).

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
	<!-- inside a vui component, controls need no classes to look right;
	     vui-btn--primary here is only the emphasis -->
	<form method="dialog">
		<input name="name" autofocus />
		<button value="save" class="vui-btn--primary">Save</button>
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

The base layer reads [`@marianmeres/design-tokens`](https://jsr.io/@marianmeres/design-tokens)
variables with the prefix **`vui-`** (`--vui-color-surface`, `--vui-color-border`, …) — once,
in one file — and republishes each under **the same name minus `color-`** with a
**system-color** fallback (`--vui-surface`, `--vui-border`, `--vui-ring`, …) for the components
to read. Alongside them sit the structural tokens: radius and shadow in three tiers
(`--vui-radius` / `-button` / `-container`, `--vui-shadow` / `-overlay` / `-dialog`),
`--vui-border-width`, `--vui-transition`. So:

- **No theme at all** → still looks right, and follows the page's `color-scheme`.
- **A generated theme** → drop one of `gallery/themes/*.css` into the page (light on `:root`,
  dark on `:root.dark`), or generate your own: `deno task themes:build` (see
  [`gallery/themes/_generate.ts`](./gallery/themes/_generate.ts)).
- **Tokens under another prefix already?** Regenerate with `"vui-"`, or set the handful of
  `--vui-*` names the kit reads (the whole vocabulary is one table in
  [API.md](./API.md#the-vocabulary)) on `:root` yourself.
- **Bootstrap Reboot on the page?** Generate through the design-tokens **reboot bridge**
  (`generateThemedCss`, as `gallery/themes/_generate.ts` does): the `--bs-*` variables come out
  alongside the `--vui-color-*` ones, from the same theme, so Reboot follows your theme and your
  `:root.dark`. The tokens never collide — but the **stylesheet** needs a layer, see
  [Controls](#controls) below.

No Tailwind, no utility classes in templates — the kit never assumes a page-level CSS framework.

## Controls

Buttons and inputs are **styles, not components** — one look, shared by everything. The filled
variants are the five `design-tokens` semantic roles, so a theme drives them all:

```html
<button class="vui-btn">default</button>
<button class="vui-btn vui-btn--primary">Save</button>
<button class="vui-btn vui-btn--accent">Accent</button>
<button class="vui-btn vui-btn--destructive">Delete</button>
<button class="vui-btn vui-btn--warning">Careful</button>
<button class="vui-btn vui-btn--success">Done</button>
<button class="vui-btn vui-btn--ghost vui-btn--icon" aria-label="Close">✕</button>
```

…and inside any vui component, bare markup gets that same look with no classes at all, which is
what makes a `<form method="dialog">` dropped into a dialog body come out right. Building a
footer in JS? `button("Delete", { variant: "destructive", onClick })` returns an element with
those classes on it. A container adapts every control inside it — its own and yours — by
re-declaring `--vui-control-bg` &c. on itself; no descendant selectors anywhere. A variant is
that same move one element down (which is why a `--success` button in a dialog footer stays
green), so inventing a sixth role is five custom properties on a class of your own. Sizes ride
the same channel (`--vui-control-min-height`, `-py`, `-px`), so a dense toolbar can shrink its
controls the same way.

Everything the kit defines lives in the `vui.base` / `vui.components` **cascade layers**, so
your own unlayered CSS overrides any of it without `!important` or a specificity fight. The
corollary: a **reset** is unlayered CSS too. If your page loads one — Bootstrap Reboot, say,
the usual companion of the design-tokens reboot bridge — import it into a layer of its own
(`@layer reset, vui.base, vui.components;` then `@import url("reboot.css") layer(reset);`) or it
beats the kit and squares every button. See
[API.md → Base layer](./API.md#base-layer), and flip the **reboot** picker in the gallery to see
both outcomes.

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
covers the index and lints every component file's anatomy — including the style rules that keep
the kit consistent: no raw design tokens, no hard-coded colors, and no component painting a
control the base layer owns.

## API

See [API.md](./API.md) for the full reference (loaders, each component's props, view API,
events, and the CSS variables it reads).

## License

[MIT](LICENSE)
