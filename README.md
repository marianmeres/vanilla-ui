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
small **base layer** (`components/base.css`) holding the token vocabulary, the control
primitives — buttons, inputs, menu items, summaries, tabs, switches, the focus ring — and a
little chrome (badge, alert, card, table), so nothing in the kit can drift apart. The
rationale is in [`docs/DESIGN.md`](./docs/DESIGN.md).

## Components

| Component                | File                                                         | Built on                             | Status |
| ------------------------ | ------------------------------------------------------------ | ------------------------------------ | ------ |
| dialog · drawer · sheet  | [`components/dialog.html`](./components/dialog.html)         | native `<dialog>`                    | ✅     |
| popover · menu · tooltip | [`components/popover.html`](./components/popover.html)       | Popover API + CSS Anchor Positioning | ✅     |
| disclosure               | [`components/disclosure.html`](./components/disclosure.html) | native `<details>` / `<summary>`     | ✅     |
| tabs                     | [`components/tabs.html`](./components/tabs.html)             | ARIA tabs + `hidden="until-found"`   | ✅     |
| toast                    | [`components/toast.html`](./components/toast.html)           | Popover API (top layer) + timers     | ✅     |

A drawer and a sheet are the dialog with a `placement` — `"start"` / `"end"` pins it to an edge
full height, `"top"` / `"bottom"` full width — because the top layer, the focus trap, Esc and
focus restore are already in the box. There is no drawer component.

Deferred: select / combobox — the platform has no restylable element for them yet, and
`base.css` already paints the native `<select>`. See
[`docs/DESIGN.md` → Roadmap](./docs/DESIGN.md#5-roadmap).

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
(`../components/`), so no paths to configure. Serving them from elsewhere (a vendored folder,
say)? Pass the base: `loadAll("https://cdn.example/vanilla-ui/components/")`.

**Off a CDN**, with nothing copied: jsDelivr's npm mirror serves the published package with
CORS on — `mod.js` as JavaScript, the `.html` files as `text/plain`, which `loadComponent` is
happy with (it fetches text and builds its own module) — and `loadAll()` finds `components/`
from there by itself. The npm build keeps `@marianmeres/vanilla` a **bare import**, so the map
still names both specifiers — and that is the point: point `@marianmeres/vanilla` at your own
copy (or at vanilla's own CDN file, as below) and the kit, plus every component it fetches,
binds to it. One copy, as above.

```html
<script type="importmap">
{
	"imports": {
		"@marianmeres/vanilla": "https://cdn.jsdelivr.net/npm/@marianmeres/vanilla@1/dist/mod.js",
		"@marianmeres/vanilla-ui": "https://cdn.jsdelivr.net/npm/@marianmeres/vanilla-ui@0.4/dist/mod.js"
	}
}
</script>
```

jsr.io is a registry, not a CDN: a browser's module request for a file there gets an HTML page
back, and the MIME type is refused.

Components also emit **`CustomEvent`s** on their root (`vui:close` here), so a plain listener
works too — handy when the dialog is created far from where its result is needed.

### A menu, or any popover

`createPopover` is an anchored, light-dismissing surface on the native Popover API — click
outside or Esc closes it, CSS Anchor Positioning places it (and flips it at the viewport edge;
a browser without it gets the same from a few lines of JS). A `<button>` anchor is the native
invoker, so the platform toggles it. With `role: "menu"` it is a menu: the items are bare
`<button role="menuitem">`s, painted by the base layer for that role alone, and the kit adds
focus, ↑ ↓ Home End, Tab-to-close and `vui:select`.

```html
<button id="more" class="vui-btn">more ▾</button>

<template id="tpl-actions">
	<div class="vui-menu">
		<button role="menuitem" value="rename">Rename <kbd>F2</kbd></button>
		<hr />
		<button role="menuitem" value="delete"
			class="vui-menuitem--destructive">Delete</button>
	</div>
</template>

<script type="module">
import { fromTemplate, loadAll } from "@marianmeres/vanilla-ui";

const { createPopover } = await loadAll();
createPopover({
	anchor: document.getElementById("more"), // toggles it; the popover lands right after it
	role: "menu",
	body: fromTemplate("tpl-actions"),
	onSelect: (value) => console.log("picked:", value), // "rename" | "delete"
});
</script>
```

The anchor need not be in the document yet: a popover built inside a `createView` mountFn,
before the view is appended, places itself after the anchor on the first click (or on `open()`).

`role: "tooltip"` is the other mode, on the same surface and the same placement: hover or
keyboard-focus the anchor and it shows, and the anchor gets `aria-describedby` rather than
`aria-expanded` — a tooltip is not a widget its anchor expands. It is `popover="hint"` where the
platform has that (so a tip inside a menu does not close the menu) and `pointer-events: none`
always, which is the design and not an optimisation: a tooltip the pointer can enter is a
popover somebody mislabelled. Text goes in; nothing else can.

```ts
createPopover({ anchor: helpBtn, role: "tooltip", body: "Only the owner can do this." });
```

Leave `role` off for a plain popover (a form, a hint, anything) and pick a `placement`
(`"bottom-start"` by default, `"top"`, `"right"`, …).

### A disclosure, or a whole accordion

`createDisclosure` is a `<details>`/`<summary>` with the kit's box on it: the toggle, the
keyboard, `aria-expanded` and find-in-page are the browser's, and one `name` shared by several
of them is an accordion — the platform keeps at most one open, with no group component and no
JS. The panel animates via `::details-content` where the browser has it, and snaps where it
does not.

```ts
const { createDisclosure } = await loadAll();

for (const [question, answer] of faq) {
	const d = createDisclosure({
		summary: question,
		body: answer, // text | element | view
		name: "faq", // ← the exclusive group; drop it for independent sections
		onOpen: () => console.log("opened:", question),
	});
	list.append(d.el);
}
```

The `<summary>` is a base-layer control like a button, so a plain `<details>` you write into a
dialog body or a panel looks the same without a single class.

### Tabs

`createTabs` takes the tabs as an array — a tab is a **pair** (a label and a panel), and tying
the two together with ids and aria is the whole reason the component exists. It writes the
`role="tablist"` strip, the roving `tabindex`, `aria-controls` / `aria-labelledby`, and the
keyboard: ← → (↑ ↓ when vertical), Home, End, selecting as it moves unless you ask for
`activation: "manual"`.

```ts
const { createTabs } = await loadAll();

const tabs = createTabs({
	ariaLabel: "Settings",
	selected: "profile", // default: the first enabled tab
	tabs: [
		{ value: "profile", label: "Profile", panel: fromTemplate("tpl-profile") },
		{ value: "billing", label: "Billing", panel: "Nothing due." }, // text | element | view
		{ value: "api", label: "API keys", panel: createKeyList(), disabled: true },
	],
	onSelect: (value) => console.log("showing:", value), // never for the initial one
});
page.append(tabs.el);

tabs.select("billing");
tabs.tab("api").disabled = false; // read live — nothing to re-render
```

The panels you are not looking at are `hidden="until-found"`, so **find-in-page still finds
them**: the browser reveals the panel, and the component selects its tab. And a tab is a
`<button role="tab">` with no class on it — the base layer paints it by that role, so
`.vui-tab` / `.vui-tablist` give a hand-written strip (a nav of `<a>`s, say) the same look with
no factory at all.

### Toasts

`createToast` builds a **region**, not a widget: one call makes the rail, and every `show()`
puts a message in it. The rail lives in the **top layer** (`popover="manual"`) and re-enters it
on every toast, so a message is never buried by a modal dialog's backdrop or by a page's
`z-index`.

```ts
const { createToast } = await loadAll();

const toasts = createToast({ position: "top-end" }); // ttl 4000, max 5, ✕ and countdown on

toasts.show("Draft saved.");
toasts.show("Upload failed — the server said 502.", {
	variant: "destructive",
	icon: "✕",
});

// sticky, with a way out of its own
const t = toasts.show("Moved 12 files to Archive.", {
	ttl: 0,
	action: button("Undo", { onClick: () => (restore(), t.dismiss()) }),
});
```

Hover a toast — or tab into one — and every clock holds, countdown bars included. Show the
same message twice and it gets a `×2` badge and a fresh clock instead of a second copy (the
`id` defaults to the message text; pass your own to group differently). Over `max`, the oldest
goes. A `variant` **tints** the surface rather than filling it, so the text keeps its contrast
on every theme and the ✕ inside is the same base-layer control as the dialog's.

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
what makes a `<form method="dialog">` dropped into a dialog body come out right. A menu item is
the third control, keyed on its role: `<button role="menuitem">` in a `.vui-menu` needs no class
either (`.vui-menuitem` is the same look outside a component; `--destructive` tints it). A
`<summary>` is the fourth, keyed on the element — a row with a caret that turns with its
`<details>` (`.vui-summary` outside a component). A tab is the fifth, keyed on `role="tab"`,
with `.vui-tablist` for the strip it sits in. A switch is the sixth, keyed on `role="switch"` —
`<input type="checkbox" role="switch">` and the platform keeps everything that is not paint, so
there is no JS and no `aria-checked` to sync. Checkboxes, radios and ranges are not drawn at
all, only tinted (`accent-color`), which is the other half of why the input rule cannot
`all: unset`. Building
a footer in JS? `button("Delete", { variant: "destructive", onClick })` returns an element with
those classes on it. A container adapts every control inside it — its own and yours — by
re-declaring `--vui-control-bg` &c. on itself; no descendant selectors anywhere. A variant is
that same move one element down (which is why a `--success` button in a dialog footer stays
green), so inventing a sixth role is five custom properties on a class of your own. Sizes ride
the same channel (`--vui-control-min-height`, `-py`, `-px`), so a dense toolbar can shrink its
controls the same way.

Not everything in the base layer is a control. A **badge**, an **alert**, a **card** and a
**table** are chrome: nothing there hovers, focuses or presses, so none of it reads the control
context — a badge in a dialog panel keeps its color while every button around it lifts. An
alert is the toast's treatment standing still (a 12% wash of the role, the border tinted, the
role at full strength on the icon alone), which is what lets it hold ordinary buttons. And a
`.vui-field` marks an error on the field rather than the control: `[data-invalid]` for a
server-side one, `:has(:user-invalid)` — the platform's own post-interaction state, not
`:invalid` — for the rest.

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
