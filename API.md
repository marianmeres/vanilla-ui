# API

The typed index (`src/mod.ts`, built to `dist/mod.js`) exports the loaders and types below
**and re-exports everything from `@marianmeres/vanilla`** — see
[its API](https://jsr.io/@marianmeres/vanilla/doc) for `observable`, `createView`, `mount`, …

## Functions

### `loadAll(base?)`

Fetch and adopt every component (in parallel) and return the typed factories. Call it once,
`await` it, then mount at will. Idempotent per URL (each file is fetched once).

**Parameters:**

- `base` (`string`, optional) — URL of the `components/` directory. Default:
  [`COMPONENTS_BASE`](#components_base).

**Returns:** `Promise<VanillaUi>` — `{ createDialog, createPopover }`.

**Example:**

```ts
const { createDialog, createPopover } = await loadAll();
```

---

### `loadDialog(base?)`

Load `components/dialog.html` alone and return its typed factory.

**Parameters:**

- `base` (`string`, optional) — as in `loadAll`.

**Returns:** `Promise<CreateDialog>`.

---

### `loadPopover(base?)`

Load `components/popover.html` alone and return its typed factory.

**Parameters:**

- `base` (`string`, optional) — as in `loadAll`.

**Returns:** `Promise<CreatePopover>`.

---

### `loadStyles(base?)`

Fetch `components/base.css` — the **base layer** — and install it as `<style id="vui-base">`,
prepended to `<head>`. Idempotent, and a no-op if an element with that id is already in the
document (put your own `<link rel="stylesheet" id="vui-base" …>` in the page to load it before
first paint, or to replace it wholesale).

Every `load*` function above awaits this already; call it directly only when you want the
control primitives (`.vui-btn`, `.vui-input`, [`button()`](#buttonlabel-options)) on a page
that loads no component. See [Base layer](#base-layer) for what it defines.

**Parameters:**

- `base` (`string`, optional) — as in `loadAll`.

**Returns:** `Promise<void>`.

---

### `button(label, options?)`

Build a `<button>` styled by the base layer. Not a view and not a component — a button has no
behavior, so this is markup plus the same `.vui-btn` classes hand-written HTML would use. For
footers and toolbars assembled in JS.

**Parameters:**

- `label` (`string`) — the button text (set as `textContent`).
- `options` (`ButtonOptions`, optional)
  - `variant` (`ButtonVariant`) — `"default"`, one of the five design-tokens roles
    (`"primary"`, `"accent"`, `"destructive"`, `"warning"`, `"success"`), or `"ghost"`.
    Default: `"default"`.
  - `icon` (`boolean`) — square + round, for a single glyph. Default: `false`.
  - `type` (`"button" | "submit" | "reset"`) — Default: `"button"`.
  - `value` (`string`) — a `<form method="dialog">` submit's `value` becomes the dialog's
    `returnValue`.
  - `disabled` (`boolean`), `ariaLabel` (`string`), `class` (`string`, appended).
  - `role` (`string`) — the `role` attribute. `"menuitem"` makes it a menu item: inside a menu
    [popover](#createpopoverprops--componentspopoverhtml) the keyboard reaches it, and the
    base layer paints it as one (by the role, over `.vui-btn`).
  - `onClick` (`(e: MouseEvent) => void`) — plain listener; it dies with the element.

**Returns:** `HTMLButtonElement`.

**Example:**

```ts
const row = document.createElement("div");
row.className = "vui-row";
row.append(
	button("Keep", { onClick: () => dlg.close("keep") }),
	button("Delete", { variant: "destructive", onClick: () => dlg.close("delete") }),
);
const dlg = createDialog({ title: "Delete 3 items?", footer: row });
```

---

### `componentUrl(name, base?)`

Absolute URL of one component file.

**Parameters:**

- `name` (`string`) — the component name (`"dialog"`).
- `base` (`string`, optional) — Default: `COMPONENTS_BASE`.

**Returns:** `string` — e.g. `…/components/dialog.html`.

---

### `baseStylesUrl(base?)`

Absolute URL of the base stylesheet.

**Parameters:**

- `base` (`string`, optional) — as in `loadAll`.

**Returns:** `string` — e.g. `…/components/base.css`.

---

## Constants

### `COMPONENTS_BASE`

`string` — Absolute URL of the `components/` directory, resolved as `../components/` relative
to the index module's own URL (`src/mod.ts` in Deno, `dist/mod.js` in the browser). This is
why the kit needs no path configuration when served as a folder.

---

### `BASE_STYLES_ID`

`"vui-base"` — the id of the element [`loadStyles`](#loadstylesbase) injects, and the id to
give your own element to pre-empt it.

---

## Base layer

`components/base.css`, installed by [`loadStyles()`](#loadstylesbase). Not a component: no
template, no factory. It is what makes every control in the kit — and every control a consumer
drops into a slot — look like one kit. Rationale: [`docs/DESIGN.md` §D9](./docs/DESIGN.md).

### Cascade layers

The file opens with `@layer vui.base, vui.components;`. Everything it defines is in `vui.base`;
every component's `@scope` block is in `vui.components`. **Your own CSS, unlayered, beats both**
whatever its specificity — so overriding anything here needs no `!important` and no specificity
games:

```css
button {
	padding: 12px;
} /* wins over .vui-btn */
```

### With a reset on the page (Bootstrap Reboot)

That same rule cuts the other way: a **reset** is unlayered CSS too, so it also beats the kit.
[Bootstrap Reboot](https://getbootstrap.com/docs/5.3/content/reboot/) — the usual companion of
the `@marianmeres/design-tokens` [reboot bridge](https://jsr.io/@marianmeres/design-tokens/doc/reboot/~)
— loaded plainly will square every `.vui-btn` (`button { border-radius: 0 }`), push controls off
their shared height (`line-height: inherit` over the kit's `1.25`, which a `<select>` ignores),
turn a `.vui-btn` on a `<summary>` back into a `list-item`, and make `.vui-field > label`
`inline-block`. Nothing here is the kit losing an argument it should win — it is the escape
hatch above, used by accident.

**Put the reset in a layer.** Name the layer before anything loads, so its position is fixed
below the kit's, then import into it:

```html
<style>
@layer reset, vui.base, vui.components;
</style>
<style>
@import url("./reboot.css") layer(reset);
</style>
```

Order matters, not the name: a layer takes its place the first time it is mentioned, so the
`@layer reset, vui.base, vui.components` statement must come **before** `base.css` (which
declares its own two) or the reset lands last and wins anyway.

**The tokens are friendlier.** The bridge emits `--bs-*` alongside `--vui-color-*` from the same
theme — two vocabularies, no collision — and generating your theme through it
(`generateThemedCss` rather than `generateThemeCss`) is what makes Reboot follow your theme and
your dark class instead of painting Bootstrap's own white page. One ordering catch, and only
while Reboot is unlayered: `reboot.css` redeclares every `--bs-*` on `:root` itself, so it must
load **before** the theme or it overwrites the bridge. In a layer that stops mattering — the
theme's unlayered custom properties win from anywhere.

The gallery does all of this: its theme files carry the bridge, and the **reboot** picker
switches between off / `layer(reset)` / unlayered so the difference is visible.

### The vocabulary

Every design token the kit reads is resolved here once, with a system-color fallback, so a page
with **no theme** still renders correctly (and follows `color-scheme`). **The name is the
token's name minus `color-`**: `--vui-color-surface-foreground` → `--vui-surface-foreground`.
Same spelling as `@marianmeres/design-tokens` and `@marianmeres/stuic`, one rule to remember.
Components read these names — never `--vui-color-*` directly. Override any of them on `:root`,
or on a subtree.

| Group   | Variables                                                                                                                                                              |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| page    | `--vui-background`, `--vui-foreground`                                                                                                                                 |
| surface | `--vui-surface`, `--vui-surface-foreground`, `--vui-surface-hover`, `--vui-surface-1`, `--vui-surface-1-foreground`, `--vui-surface-1-hover`, `--vui-surface-1-active` |
| text    | `--vui-muted`, `--vui-muted-foreground`                                                                                                                                |
| roles   | `--vui-primary`, `--vui-accent`, `--vui-destructive`, `--vui-warning`, `--vui-success` — each also with `-foreground`, `-hover`, `-active`                             |
| chrome  | `--vui-border`, `--vui-border-hover`, `--vui-input`, `--vui-input-hover`, `--vui-ring`, `--vui-scrim`                                                                  |

The five **roles** are the `@marianmeres/design-tokens` semantic colors, each mapped straight
through with its own hover / active / foreground token, so a generated theme drives all of them
at once. Without a theme they fall back to a system pair where the platform has one
(`AccentColor`, `Highlight`, `Mark`) and to a mix toward `CanvasText` where it does not.

### Structural tokens

Kit constants, not theme tokens — also on `:root`, also overridable globally or per subtree.
Three tiers where one size does not fit: a rounded button and a rounded card are different
roundings, a popover and a modal are different elevations.

| Group  | Variables                                                                  | Defaults                        |
| ------ | -------------------------------------------------------------------------- | ------------------------------- |
| radius | `--vui-radius` (elements), `--vui-radius-button`, `--vui-radius-container` | `0.5rem` · `0.5rem` · `0.75rem` |
| shadow | `--vui-shadow` (resting), `--vui-shadow-overlay`, `--vui-shadow-dialog`    | small · medium · large          |
| border | `--vui-border-width`                                                       | `1px`                           |
| layout | `--vui-gap`                                                                | `0.5rem`                        |
| focus  | `--vui-focus-width`, `--vui-focus-offset`                                  | `2px` · `1px`                   |
| motion | `--vui-transition` (a duration; `0ms` under `prefers-reduced-motion`)      | `150ms`                         |

`:root { --vui-radius-button: 9999px }` makes every button a pill and touches nothing else.

### Control context

The `--vui-control-*` names are a **channel**, not a setting: nothing declares them by default.
Every control reads them with its default in the fallback, resolved _at the control_ —
`background: var(--vui-control-bg, var(--vui-surface))` — and anything above it that wants to
restyle the controls inside it just re-declares them on itself. (They are deliberately not
declared at `:root`: a `:root` declaration substitutes its `var()`s eagerly, right there, so a
container that set three of the five would inherit a fourth already baked to the page's colors.
The fallback pattern is the one `@marianmeres/stuic` uses for the same reason.)

| Channel                    | Default                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| `--vui-control-bg`         | `--vui-surface`                                                    |
| `--vui-control-foreground` | `--vui-surface-foreground`                                         |
| `--vui-control-bg-hover`   | `--vui-surface-hover`                                              |
| `--vui-control-bg-active`  | a hair of `currentColor` over the hover color                      |
| `--vui-control-border`     | `--vui-border`                                                     |
| `--vui-control-min-height` | `2.5rem` — what makes a `<select>` the same height as a `<button>` |
| `--vui-control-py` / `-px` | `0.45rem` / `0.9rem`                                               |
| `--vui-control-size`       | `2rem` — square (icon) controls                                    |

Sizes are in the channel too, so a dense toolbar can shrink every control inside it the way a
panel lifts them. The dialog panel does exactly this to lift controls off its surface:

```css
.vui-dialog__panel {
	--vui-control-bg: var(--vui-surface-1);
	--vui-control-foreground: var(--vui-surface-1-foreground);
	--vui-control-bg-hover: var(--vui-surface-1-hover);
	--vui-control-bg-active: var(--vui-surface-1-active);
	--vui-control-border: var(--vui-surface-1-hover);
}
```

**A variant is the same thing, one element down.** `.vui-btn--success` declares no paint at
all — it re-declares that context on the button itself, which is why it beats the container's
(a success button in a dialog footer is green, not surface-1) and why every state comes out
consistent without a rule per variant. Your own role works the same way, no kit change needed:

```css
.my-brand-btn {
	--vui-control-bg: var(--brand);
	--vui-control-foreground: var(--brand-foreground);
	--vui-control-bg-hover: var(--brand-hover);
	--vui-control-bg-active: var(--brand-active);
	--vui-control-border: transparent;
}
```

### Classes

| Class                                                                          | What                                                         |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `.vui-btn`                                                                     | the button primitive (`all: unset` + the control paint)      |
| `.vui-btn--primary` / `--accent` / `--destructive` / `--warning` / `--success` | the five design-tokens roles, filled                         |
| `.vui-btn--ghost`                                                              | no fill; borrows its container's foreground on hover         |
| `.vui-btn--icon`                                                               | square + round, for a single glyph                           |
| `.vui-input` / `.vui-select`                                                   | text inputs, selects, textareas                              |
| `.vui-menuitem`                                                                | a menu item (what `role="menuitem"` gets inside a component) |
| `.vui-menuitem--destructive`                                                   | colored text and a tinted hover — never a filled row         |
| `.vui-field`                                                                   | a stacked `<label>` + full-width control                     |
| `.vui-row`                                                                     | a wrapping flex row at `--vui-gap` (button rows, toolbars)   |
| `.vui-menu`                                                                    | a vertical list of items, with `<hr>` separators             |

**Menu items** are the third control, keyed on the ARIA role the menu popover needs anyway:
inside any vui container, `[role="menuitem"]` (also `menuitemcheckbox` / `menuitemradio`) is
painted as an item — transparent at rest, inheriting its surface's foreground, taking its hover
and active from the [control context](#control-context) (never `--vui-control-bg`; a menu does
not fill its items), a trailing `<kbd>` pushed to the far end. That rule is `:is()` at (0,1,0) on
purpose, so the role wins over `.vui-btn` and `button("Rename", { role: "menuitem" })` comes out
as an item. Don't put `.vui-btn--destructive` on one (its white foreground on no fill);
`.vui-menuitem--destructive` is the item-shaped version.

### Bare markup inside a component

Any element carrying a `vui-` class is a **container hook**: bare `<button>`, `<input>`,
`<select>`, `<textarea>` and `[role="menuitem"]` descendants get the control look with no
classes at all. So a `<form method="dialog">` dropped into a dialog body is styled, and takes
that dialog's control context, without knowing the kit exists:

```html
<form method="dialog">
	<div class="vui-field">
		<label for="name">Your name</label>
		<input id="name" name="name" />
	</div>
	<div class="vui-row" style="justify-content: flex-end">
		<button type="submit" value="cancel">Cancel</button>
		<button type="submit" value="save" class="vui-btn--primary">Save</button>
	</div>
</form>
```

That default has the reach of any reset — it is zero-specificity and layered, so your own CSS
takes it back whenever you want it back.

---

## Components

### `createDialog(props?)` — `components/dialog.html`

A modal (or non-modal) dialog on the native `<dialog>` element. The platform provides the top
layer, backdrop, focus trap, Esc-to-close and focus restore; the component adds a
header / body / footer chrome, a `returnValue` convention, and events out.

**Parameters:** `props` (`DialogProps`, optional)

| Prop              | Type                            | Default | Description                                                                  |
| ----------------- | ------------------------------- | ------- | ---------------------------------------------------------------------------- |
| `title`           | `string`                        | `""`    | Heading text. Empty → no heading (header hidden if `closeButton` is off too) |
| `body`            | `Slot`                          | —       | Content: text, an element, or a view (mounted + destroyed with the dialog)   |
| `footer`          | `Slot`                          | —       | Footer content (typically buttons). Absent → footer hidden                   |
| `modal`           | `boolean`                       | `true`  | `showModal()` vs `show()`                                                    |
| `closeOnBackdrop` | `boolean`                       | `true`  | Backdrop click closes (modal only)                                           |
| `closeButton`     | `boolean`                       | `true`  | Render the ✕ in the header                                                   |
| `onClose`         | `(returnValue: string) => void` | —       | Callback up, once per close                                                  |

**Returns:** `DialogView`

| Member                | Description                                                           |
| --------------------- | --------------------------------------------------------------------- |
| `el`                  | The `<dialog>` root (`data-scope="dialog"`). Append it anywhere.      |
| `isOpen`              | `ReadonlyObservable<boolean>`                                         |
| `open()`              | `showModal()` / `show()`. No-op if open. Resets `returnValue`.        |
| `close(returnValue?)` | Closes with a value (default `"close"`). No-op if not open.           |
| `destroy()`           | Runs cleanups, destroys a mounted `body`/`footer` view, removes `el`. |

**`returnValue` convention** (what `onClose` and `vui:close` receive):

| Value        | How                                                                      |
| ------------ | ------------------------------------------------------------------------ |
| `"close"`    | the ✕ button, or `close()` with no argument                              |
| `"cancel"`   | Esc                                                                      |
| `"backdrop"` | click outside the panel                                                  |
| anything     | `close("x")`, or the `value` of a `<form method="dialog">` submit button |

**Events** (dispatched on `el`, bubbling):

| Event       | `detail`          | When                     |
| ----------- | ----------------- | ------------------------ |
| `vui:close` | `{ returnValue }` | after the native `close` |

**CSS variables read** (from the [base vocabulary](#the-vocabulary) and
[structural tokens](#structural-tokens), each with a fallback):

`--vui-surface`, `--vui-surface-foreground`, `--vui-border`, `--vui-radius-container`,
`--vui-shadow-dialog`, `--vui-scrim`, `--vui-gap`.

**CSS variables set** — on `.vui-dialog__panel`, so every control inside the dialog (the ✕,
footer buttons, anything in a slot) lifts off the panel's surface: `--vui-control-bg`,
`--vui-control-foreground`, `--vui-control-bg-hover`, `--vui-control-bg-active`,
`--vui-control-border`.

The ✕ is `.vui-btn.vui-btn--ghost.vui-btn--icon` — a base control, not a private button.

**Example:**

```ts
const dlg = createDialog({
	title: "Delete 3 items?",
	body: "This cannot be undone.",
	closeOnBackdrop: false,
	footer: row, // an element holding buttons — see button() above
	onClose: (v) => v === "delete" && store.deleteSelected(),
});
document.body.append(dlg.el);
dlg.open();

// or listen instead of (or as well as) the callback:
dlg.el.addEventListener("vui:close", (e) => console.log(e.detail.returnValue));
```

A `<form method="dialog">` inside `body` closes the dialog natively; give each submit button a
`value` and it arrives as the `returnValue`.

---

### `createPopover(props)` — `components/popover.html`

An anchored, light-dismissing surface on the native Popover API (`popover="auto"`): top layer,
click-outside and Esc to dismiss, one auto popover at a time with nesting, focus restore. A
`<button>` anchor becomes the native **invoker** — the browser toggles it, on click and keyboard,
and knows not to light-dismiss on it. Placement is CSS Anchor Positioning (flipping at the
viewport edge via `position-try-fallbacks`) where the browser has it, and a small JS
measure / flip / clamp — re-run on scroll and resize while open — where it does not. With
`role: "menu"` it is a menu. Rationale: [`docs/DESIGN.md` §D10](./docs/DESIGN.md).

**Parameters:** `props` (`PopoverProps`) — only `anchor` is required

| Prop            | Type                                         | Default          | Description                                                                                                                                                                            |
| --------------- | -------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `anchor`        | `HTMLElement`                                | —                | The trigger. A `<button>`/`<input>` is the native invoker; anything else gets a click listener. Receives `aria-expanded`, `aria-controls`, and `aria-haspopup` when `role` warrants it |
| `body`          | `Slot`                                       | —                | Content: text, an element, or a view. For a menu: the items                                                                                                                            |
| `placement`     | `PopoverPlacement`                           | `"bottom-start"` | The **preferred** side; it flips when it would overflow. `start`/`end` align the popover's inline edge with the anchor's, the bare side centers it                                     |
| `offset`        | `number`                                     | `4`              | Gap from the anchor, px                                                                                                                                                                |
| `role`          | `string`                                     | —                | The root's ARIA role, set as given. `"menu"` **also** switches on the menu behavior (below)                                                                                            |
| `trigger`       | `boolean`                                    | `true`           | Clicking the anchor toggles                                                                                                                                                            |
| `closeOnSelect` | `boolean`                                    | `true`           | Menu: activating an item closes                                                                                                                                                        |
| `onOpen`        | `() => void`                                 | —                | After the native `toggle` reports it open                                                                                                                                              |
| `onClose`       | `() => void`                                 | —                | After the native `toggle` reports it closed — whatever closed it                                                                                                                       |
| `onSelect`      | `(value: string, item: HTMLElement) => void` | —                | Menu: an item was activated                                                                                                                                                            |

**Returns:** `PopoverView`

| Member      | Description                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `el`        | The `[popover="auto"]` root (`data-scope="popover"`). The factory inserts it right after a connected anchor — the invoker needs it in the document; move it freely |
| `anchor`    | The anchor it was created with                                                                                                                                     |
| `isOpen`    | `ReadonlyObservable<boolean>` — settled synchronously by `open()`/`close()`, and by the native `toggle` for every other route                                      |
| `open()`    | `showPopover()`; inserts `el` after the anchor first if it is not in the document. No-op if open                                                                   |
| `close()`   | `hidePopover()`. No-op if not open                                                                                                                                 |
| `toggle()`  | One or the other                                                                                                                                                   |
| `destroy()` | Runs cleanups (the anchor's attributes, name and invoker link are restored), destroys a mounted `body` view, removes `el`                                          |

**Menu** (`role: "menu"`): the body holds the items — any element with `role="menuitem"`,
`menuitemcheckbox` or `menuitemradio`, typically `<button>`s in a `.vui-menu` (painted by the
[base layer](#classes) for that role, no classes needed). Opening focuses the first enabled item;
↑ ↓ move (wrapping), Home / End jump, hovering focuses, Tab closes; Enter / Space activate
(natively for a `<button>`, by hand for anything else). Activating fires `onSelect` /
`vui:select` with the item's `value` attribute (else `data-value`, else its text) and, by default,
closes. Items that are `disabled`, `aria-disabled="true"` or hidden are skipped. Items inside a
nested `data-scope` belong to that component, not to the menu.

**Events** (dispatched on `el`, bubbling):

| Event        | `detail`          | When                                  |
| ------------ | ----------------- | ------------------------------------- |
| `vui:open`   | `{ anchor }`      | after the native `toggle` (any route) |
| `vui:close`  | `{ anchor }`      | after the native `toggle` (any route) |
| `vui:select` | `{ value, item }` | menu: an item was activated           |

**CSS variables read** (from the [base vocabulary](#the-vocabulary) and
[structural tokens](#structural-tokens), each with a fallback):

`--vui-surface`, `--vui-surface-foreground`, `--vui-border`, `--vui-border-width`,
`--vui-radius-container`, `--vui-shadow-overlay`, `--vui-transition`.

**CSS variables set** — on the root, so every control inside it lifts off the surface exactly as
in the dialog panel: `--vui-control-bg`, `--vui-control-foreground`, `--vui-control-bg-hover`,
`--vui-control-bg-active`, `--vui-control-border`. Menu items take only the hover and active from
these.

**Example** — a menu:

```html
<button id="more" class="vui-btn">more ▾</button>
<template id="tpl-actions">
	<div class="vui-menu">
		<button role="menuitem" value="rename">Rename <kbd>F2</kbd></button>
		<button role="menuitem" value="archive" disabled>Archive</button>
		<hr />
		<button role="menuitem" value="delete"
			class="vui-menuitem--destructive">Delete</button>
	</div>
</template>
```

```ts
const menu = createPopover({
	anchor: document.getElementById("more"),
	role: "menu",
	body: fromTemplate("tpl-actions"),
	onSelect: (value) => value === "delete" && store.deleteSelected(),
});
// nothing else to wire: the anchor toggles it, light dismiss closes it
menu.el.addEventListener("vui:select", (e) => console.log(e.detail.value, e.detail.item));
```

A plain popover is the same without `role` — a form, say, whose bare controls are lifted by the
surface:

```ts
const pop = createPopover({
	anchor: subscribeBtn,
	body: fromTemplate("tpl-subscribe-form"),
	placement: "bottom-end",
});
pop.el.querySelector("form").addEventListener("submit", (e) => {
	e.preventDefault();
	pop.close();
});
```

Positioning notes: `start`/`end` follow the writing direction (the six vertical placements use
logical `position-area` keywords); `left`/`right` are physical. The anchored path never runs JS
after open — the browser re-resolves the placement every frame — so an anchor that moves, a
window that resizes, and a page that scrolls all just work. A popover taller than the space on
either side is not shrunk on the anchored path (it flips, then stays); the JS path clamps it into
the viewport.

---

## Types

### `Slot`

```ts
type Slot = string | HTMLElement | ViewInstance;
```

Content for a container's slot. `string` is **text** (`textContent`, never HTML); an element
is placed as-is; a view is `mount`ed so the container's `destroy()` tears it down too.

### `ButtonVariant` / `ButtonOptions`

```ts
type ButtonVariant =
	| "default"
	| "primary"
	| "accent"
	| "destructive"
	| "warning"
	| "success"
	| "ghost";

interface ButtonOptions {
	variant?: ButtonVariant; // default "default"
	icon?: boolean; // square + round
	type?: "button" | "submit" | "reset"; // default "button"
	value?: string;
	disabled?: boolean;
	ariaLabel?: string;
	role?: string; // "menuitem" → a menu item
	class?: string;
	onClick?: (e: MouseEvent) => void;
}
```

### `DialogProps`

```ts
interface DialogProps {
	title?: string;
	body?: Slot;
	footer?: Slot;
	modal?: boolean; // default true
	closeOnBackdrop?: boolean; // default true
	closeButton?: boolean; // default true
	onClose?: (returnValue: string) => void;
}
```

### `DialogView`

```ts
interface DialogView extends ViewInstance {
	el: HTMLDialogElement;
	isOpen: ReadonlyObservable<boolean>;
	open(): void;
	close(returnValue?: string): void;
}
```

### `CreateDialog`

```ts
type CreateDialog = (props?: DialogProps) => DialogView;
```

### `PopoverPlacement`

```ts
type PopoverPlacement =
	| "bottom-start"
	| "bottom"
	| "bottom-end"
	| "top-start"
	| "top"
	| "top-end"
	| "left"
	| "right";
```

### `PopoverProps`

```ts
interface PopoverProps {
	anchor: HTMLElement; // required
	body?: Slot;
	placement?: PopoverPlacement; // default "bottom-start"
	offset?: number; // px, default 4
	role?: "menu" | "dialog" | "listbox" | (string & {}); // "menu" switches the menu behavior on
	trigger?: boolean; // default true
	closeOnSelect?: boolean; // menu; default true
	onOpen?: () => void;
	onClose?: () => void;
	onSelect?: (value: string, item: HTMLElement) => void; // menu
}
```

### `PopoverView`

```ts
interface PopoverView extends ViewInstance {
	el: HTMLElement;
	anchor: HTMLElement;
	isOpen: ReadonlyObservable<boolean>;
	open(): void;
	close(): void;
	toggle(): void;
}
```

### `CreatePopover`

```ts
type CreatePopover = (props: PopoverProps) => PopoverView;
```

### `VanillaUi`

```ts
interface VanillaUi {
	createDialog: CreateDialog;
	createPopover: CreatePopover;
}
```

What `loadAll()` resolves to. Grows with every component.
