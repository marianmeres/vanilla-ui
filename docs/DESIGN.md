# Design Document — `@marianmeres/vanilla-ui`

> Reusable UI primitives on top of `@marianmeres/vanilla`, shipped as single-file `.html`
> components. This is the **rationale and rulebook** for the kit — read it before adding a
> component. Vanilla's own [DESIGN.md](../../vanilla/docs/DESIGN.md) (principles P1–P5) is the
> constitution underneath; nothing here overrides it.

---

## 1. Purpose & audience

The author prototypes as standalone vanilla-JS HTML pages with `@marianmeres/vanilla` for a
little reactivity. Every prototype re-invents the same dialog, menu, tabs and toast. This kit
is those pieces, done once, looking right immediately on any
[`design-tokens`](https://jsr.io/@marianmeres/design-tokens) theme.

**Audience: the author's own prototyping.** That single fact decides most of what follows —
the kit ships _markup_ (not headless behaviors), lives next to the prototype (not behind a
build), and the gallery is its test suite. It is published to JSR/npm like every
`@marianmeres` package, but it is _not_ trying to be a general-purpose, framework-agnostic
component library for strangers (see §6 for what that would change).

### Scope

**In:** shipped single-file components (template + scoped style + factory), one shared base
layer (the token vocabulary + the control primitives), a typed index that loads them,
design-tokens theming with graceful fallbacks, nesting via `data-scope`, events out, a gallery.

**Out (deliberately):** a headless/behavior-only layer, custom elements, a keyed-list
reconciler, automatic style scoping, Tailwind in templates, a slot/children system beyond
`Slot`, a button _component_. See §6.

---

## 2. Decisions and why

### D1 — Ship templates, not headless behaviors

A public primitives library would ship _behaviors_ over consumer-authored markup (the
Zag/Melt/Ark model), because that sidesteps distributing HTML and CSS. For prototyping it is
exactly backwards: the whole point is a dialog that looks right the moment it is mounted. So
each component is one `.html` file — markup, style, logic — loaded with vanilla's
`loadComponent`. This is vanilla's strongest form of "HTML lives in HTML" (P2), and the
distribution problem disappears because the kit is served from a folder next to the page.

Consumer override is still there for free: vanilla's loaders **skip a template id already in
the document**, so a page that declares its own `tpl-vui-dialog` before `loadAll()` wins.

### D2 — Tokens with fallbacks, never a CSS framework

Components read `@marianmeres/design-tokens` variables under the **`vui-`** prefix, through
local aliases that fall back to **system colors**. Since D9 the token is read once — in
`components/base.css`, which resolves it into a short name — and a component aliases _that_,
keeping a last-ditch system color so the file still renders if it is ever loaded bare:

```css
/* components/base.css — the name is the token's name minus `color-` */
:root {
	--vui-surface: var(--vui-color-surface, Canvas);
}
/* components/<name>.html */
:scope {
	--_bg: var(--vui-surface, Canvas);
}
```

Three consequences, all wanted: a page with no theme still renders correctly (and follows
`color-scheme`); dropping in any generated theme restyles everything; and the kit never
assumes a page-level framework — no Tailwind classes in templates, ever. (Vanilla's examples
use Tailwind from a CDN; that is fine _around_ the components, not _inside_ them.)

`design-tokens` is used at **generation time only** (`gallery/themes/_generate.ts`); the kit
has no runtime dependency on it.

### D3 — One copy of vanilla: the index re-exports it

The components import the base library by bare specifier (`from "@marianmeres/vanilla"`),
because `loadComponent` runs them from a `blob:` URL where only the host's import map can
resolve anything. The host also imports the kit. Two specifiers, two possible copies — unless
the index **re-exports vanilla** (`export * from "@marianmeres/vanilla"`) and the host maps
**both** specifiers to the one built `dist/mod.js`. One scheduler, one everything, one file to
point at. `dist/mod.js` is therefore tracked: it is the deliverable a prototype's import map
names.

### D4 — `data-scope` on every root

Vanilla's `refs` / `applyBindings` / `delegate` scan a whole subtree and stop only at a nested
`data-scope` root. A kit nests from day one (a dialog holding tabs holding a menu), so **every
component root carries `data-scope="<name>"`** — enforced by the anatomy test. The same
attribute value doubles as the `@scope` anchor's sibling (`class="vui-<name>"` is what the
style block scopes to; the attribute is the behavior boundary). Two attributes, two roles,
deliberately not conflated.

### D5 — Events out twice: callback props and `CustomEvent`s

Vanilla's convention is callback props (`onClose`). A kit component is often created far from
where its result is consumed, so each root **also** dispatches a bubbling `CustomEvent` named
`vui:<event>` with a `detail` object. It costs one line, uses the platform (P3), and lets an
`enhance`d page wire a component with a plain listener.

### D6 — Containers take `Slot`s; there is no children system

A dialog needs _content_. The whole slot story is one type — `string` (text, via
`textContent`), `HTMLElement` (placed as-is, typically a `fromTemplate` clone), or
`ViewInstance` (`mount`ed, so the container's `destroy()` cascades) — and a `data-ref` per slot
in the template. No named-slot syntax, no projection, no compiler.

### D7 — Behavior is tested in a real browser; the gallery is for eyes

Component behavior needs a real browser: `loadComponent` imports the inline script from a
`blob:` URL through the host's import map, and `<dialog>` semantics are the browser's. So
every component has a page under `tests/browser/` that exercises it and reports `ok`/`FAIL`
lines into `#result`; `scripts/browser-test.ts` serves the repo, drives headless Chrome over
the DevTools protocol, and fails on any `FAIL`, uncaught exception, console error or timeout
(`deno task test:browser`). The gallery mounts **every component in every state on every
theme** for the check no script makes — does it look right. What is unit-tested in Deno: the
index (URL resolution, re-exports) and the **anatomy** of every component file (§3) on a
parsed copy with `linkedom` — the contract everything else relies on.

Two lessons baked into the dialog test: native `<dialog>` fires `close` **asynchronously**, so
tests await the event, never a timer — and the component resets `returnValue` _after_ reading
it in that handler, not on `open()`, so a re-open can never race a pending close. And removing
an open dialog fires no `close` at all, so `destroy()` settles `isOpen` itself.

### D8 — Platform first, and defer what needs a reconciler

Native `<dialog>` gives the top layer, backdrop, focus trap, Esc and focus restore. The
Popover API gives light-dismiss. `<details>` gives disclosure. Each primitive should be mostly
chrome plus keyboard/aria glue. Primitives that need **keyed list rendering** (select,
combobox) would push vanilla toward a reconciler it deliberately does not have — they come
last, and only with a design discussion first.

### D9 — One base layer: the vocabulary and the controls

A dialog needs buttons. So will the menu, the toast, and every consumer form dropped into a
slot. Before this they lived in three places — the ✕'s private rules inside
`@scope (.vui-dialog)`, the gallery's global `button { … }`, and _nothing at all_ for the
`<button value="save">` a consumer writes in a `<form method="dialog">`. So a footer looked
right in the gallery and unstyled in a real prototype (the gallery was doing the kit's job),
and the three homes had already started to drift: one hairline idea with two different
fallbacks, the focus ring typed out twice.

`components/base.css` is the answer, and it is deliberately **not a component**: no template,
no script, no `data-scope`. `loadStyles()` — awaited by every `load<Name>()` — injects it once
as `<style id="vui-base">`, prepended to `<head>`. It holds exactly two things.

**1. The vocabulary.** Every `--vui-color-*` token the kit reads is resolved here, once, under
**the token's own name minus `color-`** with its canonical system-color fallback
(`--vui-surface`, `--vui-surface-foreground`, `--vui-border`, `--vui-ring`, …). Components alias
those names, never the raw tokens. One idea, one fallback, one file — and one rule to remember,
with the same spelling `design-tokens` and `stuic` use (`foreground` is never abbreviated; `bg`
only ever appears as a context-channel suffix, which is stuic's convention too). Next to the
colors sit the **structural tokens**, taken from stuic's tiering: radius and shadow in three
tiers each (element / button / container; resting / overlay / dialog), `--vui-border-width`,
`--vui-transition`. The dialog is a container and casts a dialog shadow; a button is a button;
the popover is an overlay. One size does not fit.

**2. The controls.** A button is a **style** primitive, not a component. It has no behavior, so
it would drag `createView` / `track` / `destroy` / `data-scope` onto a leaf that needs none of
them — and a factory can only style markup it creates, which is exactly the markup a consumer's
slot content is not. CSS reaches both. Two ways in:

```html
<button class="vui-btn vui-btn--primary">anywhere on the page</button>
<button>bare, inside any vui component</button>
```

The second is a zero-specificity default on a _container hook_: `:where([class^="vui-"],
[class*=" vui-"]) :where(button, …)` — "a descendant of an element carrying a `vui-` class".
Deliberately not `[data-scope]`: that is vanilla's boundary, and the kit has no business
styling every vanilla component's buttons. `button()` in the index builds the class form for
footers assembled in JS — markup plus the same classes, not a view, not a second look.

Three mechanisms make it hold together:

- **Cascade layers, not specificity.** `@layer vui.base, vui.components;` (declared by base.css,
  which is why it must be loaded first); every component's `@scope` block sits in
  `vui.components`. Layered rules lose to unlayered ones whatever their specificity, so a
  consumer's plain `button { … }` beats all of it — override is free, no `!important`, no arms
  race. This is D1's "consumer override comes for free" applied to CSS.
- **A context channel, not descendant selectors.** A container never reaches into a control
  (`.vui-dialog__footer button { … }` is the anti-pattern — every future container has to
  repeat it and get it right). It re-declares `--vui-control-bg` / `-foreground` / `-bg-hover`
  / `-bg-active` / `-border` (and the sizes: `-min-height`, `-py`, `-px`) **on itself**, and
  controls inherit. The dialog panel lifts everything inside it to `surface-1` in five lines:
  its own ✕, footer buttons built by `button()`, and a consumer's bare `<form>` buttons alike —
  and it composes through nesting.

  The channel's defaults are **not** declared at `:root`; they live in `var()` fallbacks at the
  usage sites (`background: var(--vui-control-bg, var(--vui-surface))`). This is stuic's rule
  ("never declare a derived token at `:root`"), and it is not a style preference: a `:root`
  declaration substitutes its `var()`s eagerly, on `:root`, so a container that re-declared
  three of the five would inherit a fourth already baked to the page's colors — measured, in
  this kit, before the rule was adopted. Resolved at the control instead, every override above
  it has already been applied. (The vocabulary itself stays at `:root` on purpose: it is the
  resolve-once layer. Override the vocabulary name on a subtree, not the raw token.)

  **A variant is the same move, one element down.** `.vui-btn--success` declares no paint: it
  re-declares that context on the button. Which means the five `design-tokens` semantic roles
  (primary, accent, destructive, warning, success — each with its own hover/active/foreground
  token) cost five custom properties each and no rule of their own; every state stays
  consistent because the one base rule is still doing the painting; a variant beats the
  container it sits in, because a declaration on the element beats an inherited one; and a
  consumer's own role is the same five lines on a class the kit has never heard of. `--ghost`
  is the exception that proves it — not a role but a treatment, so it keeps one explicit
  `color` to borrow the container's foreground on hover.
- **Enforcement, not memory.** `tests/components.test.ts` fails a component that reads a
  `--vui-color-*` token directly, reads or sets a `--vui-*` name base.css does not declare,
  hard-codes a color outside a `var()` fallback, or sets a paint property (background, border,
  padding, color, font, box-shadow, outline, cursor) on a selector targeting a control. A
  component may _lay out_ a control; it may never paint one.

**What it costs.** The element default is a reset with the reach of any reset: a consumer's own
`<button>` inside a dialog is restyled unless they opt out (their own unlayered CSS, or their
own `#vui-base` element). For this audience — prototypes, where a slot that looks right with
zero classes is the entire point — that is a good trade. It would not be for a public library
styling other people's markup.

**The third control is keyed on a role.** A menu item is `<button role="menuitem">` — the
attribute the menu's keyboard and aria glue need anyway — and inside a vui container that is
also what paints it. One attribute buys the semantics, the navigation and the look; `.vui-menuitem`
is the same look for markup outside a container, `.vui-menu` lays a list out. The bare form
uses `:is()` rather than `:where()` on purpose: at (0,1,0) it ties with `.vui-btn` and, written
later, wins — so an item built by `button(label, { role: "menuitem" })`, which carries `.vui-btn`
too, comes out as the item its role says it is. An item never reads `--vui-control-bg` (a menu
does not fill its items) but takes hover and active from the channel, so a surface that lifts its
controls lifts the items' hover with them. `.vui-btn--destructive` on an item would paint its
foreground white on nothing; `.vui-menuitem--destructive` — colored text, tinted hover — is the
one modifier.

### D10 — Popover: the platform dismisses, CSS places, JS fills only the gap

The second primitive is where "platform first" (D8) gets specific. Three layers, in the order
they are trusted:

1. **`popover="auto"` does the behavior.** Top layer, light dismiss on a click outside, Esc as
   a close watcher (so it works with focus anywhere), one auto popover at a time _with_ nesting
   (a popover opened from inside another stays inside it), and focus restore on close. A
   `<button>` anchor is made the native **invoker** (`popoverTargetElement`): the browser toggles
   it on click and keyboard, exempts it from light dismiss — without that, the pointerdown that
   closes the popover is followed by the click that reopens it — nests correctly, and exposes
   `aria-expanded` itself. That relationship needs the popover in the document before the first
   click, which is why `createPopover()` is the one factory in the kit that places its own
   element (right after a connected anchor; `open()` does the same for an anchor connected
   later). The native `toggle` event is the single source of truth for state and events, exactly
   as the dialog's `close` is: `open()`/`close()` mirror it synchronously, every other route
   (light dismiss, Esc, the invoker, a bare `togglePopover()`) arrives there and nowhere else.

2. **CSS Anchor Positioning does the placement.** The anchor is named, the popover points at it,
   an inline `position-area` says which side, and `position-try-fallbacks` flips it — the other
   side, the other alignment, both, and as a last resort a full-width row with the popover
   centered — re-resolved by the browser on every frame with no listener at all. The gap is a
   margin on the anchor-facing side only (a margin all round would push a start-aligned box off
   the anchor's edge by that much; the try tactics swap margins along with everything else, so a
   flipped box keeps its gap). Support is decided per instance and all-or-nothing: `anchor-name`,
   `position-area` and `position-try-fallbacks`, or none of it — a half-supporting browser gets
   the JS path, not a half-working popover.

3. **JS does the placement only where the browser cannot.** Measure the anchor, flip if the
   preferred side has no room and the other one has, clamp into the viewport, re-run on scroll
   and resize while open. Stuic's popover falls back to a _centered modal_ instead; the kit does
   not follow it, for two reasons. The top layer makes a fixed popover's containing block the
   viewport, always — the transformed-ancestor cases that made stuic's fallback (and its
   `clampIntoViewport` backstop on the anchored path) necessary do not arise here, because the
   popover is never appended into a consumer's container. And a placement that changes shape
   per browser is a worse prototype than one that is the same everywhere for thirty lines. The
   anchored path gets no JS backstop either: two mechanisms fighting over one box on every
   scroll is exactly the kind of cleverness D8 avoids.

**Menu is a mode, not a component.** `role: "menu"` adds the aria and keyboard glue — focus the
first item on open, ↑ ↓ Home End, hover-to-focus, Tab closes, `vui:select` with the item's
`value` — over the same surface. A separate `menu.html` would have to duplicate the placement
(components import only vanilla; cross-file composition does not exist, by the anatomy
contract), and the glue is thirty lines over markup the consumer writes anyway. Items are
markup, not an `items` array: that is P2, and it is also what keeps a keyed-list reconciler out
(D8) — the popover queries `[role^="menuitem"]` at keydown time and holds no list state.

---

## 3. Anatomy of a component (the contract)

`components/<name>.html`, checked by `tests/components.test.ts`:

```html
<template id="tpl-vui-<name>">
	<ROOT class="vui-<name>" data-scope="<name>" data-on="…">
		… data-ref slots, data-on actions …
	</ROOT>
</template>

<style>
	@layer vui.components {
		@scope (.vui-<name>) {
			:scope { --_bg: var(--vui-<vocabulary name>, <system color>); … }
			…
		}
	}
</style>

<script type="module">
	import { createView, delegate, fromTemplate, refs, … } from "@marianmeres/vanilla";
	export function create<Name>({ …props } = {}) {
		return createView((track) => {
			const el = fromTemplate("tpl-vui-<name>");
			…
			return { el, …api };
		});
	}
</script>
```

Rules the test enforces: template ids start with `tpl-vui-`; the root has both the class and
`data-scope`; every `<style>` is `@scope`d to the root class **and** wrapped in
`@layer vui.components`; every `--vui-*` it reads or sets is in `components/base.css`'s
vocabulary (and no raw `--vui-color-*` token is read); no color literal outside a `var()`
fallback; no paint property on a selector targeting a control (D9); exactly one module script;
it imports vanilla by bare specifier and nothing by relative path; it exports `create<Name>`;
it never assigns `innerHTML`.

Rules the test cannot enforce (review them): a control's _placement_ is fair game but its look
is base's (the lint only sees selectors that name a control — `.vui-dialog__close { padding }`
would slip through); props are the single argument with defaults;
every subscription/listener is `track`ed; the root's _own_ non-bubbling events (a dialog's
`close`/`cancel`) go on the root's `data-on` — vanilla's `delegate` listens on the root, so it
sees them; events out are `vui:<event>` **and** a callback prop; colors come from `--vui-*`
with fallbacks; the gallery covers every state.

**Types** are declared in `src/mod.ts` (`<Name>Props`, `<Name>View`, `Create<Name>`), with a
`load<Name>()` and an entry in `VanillaUi` / `loadAll()`. The `.html` is plain JS on purpose —
the browser runs it verbatim.

---

## 4. Distribution

The kit is a folder. A prototype uses it by:

1. **Copying** `components/` + `dist/` next to the page. Zero infrastructure; divergence per
   prototype is acceptable and sometimes wanted.
2. **Serving** the kit repo and the prototype from one static root and pointing the import
   map at `…/vanilla-ui/dist/mod.js`. `loadAll()` finds `../components/` from there.
3. **A CDN** for the `.html` files, when a page lives where the folder can't be served from.
   `loadAll(base)` takes the components URL. (JSR's raw file URLs are not verified for CORS;
   jsDelivr's GitHub endpoint serves any file from a public repo, pinned by tag.)

JSR/npm publishing gives the typed index and versioning; it is not the primary consumption
path for the `.html` files.

---

## 5. Roadmap

In this order — each one mostly platform:

| # | Component       | Built on                       | Notes                                                                   |
| - | --------------- | ------------------------------ | ----------------------------------------------------------------------- |
| 1 | dialog          | `<dialog>`                     | ✅ shipped                                                              |
| 2 | menu / popover  | Popover API (`popover="auto"`) | ✅ shipped — one `popover` component, `role: "menu"` for the menu (D10) |
| 3 | disclosure      | `<details>` / `<summary>`      | mostly styling + an `isOpen` observable                                 |
| 4 | tabs            | roving `tabindex`, aria-tabs   | static panels; no list diffing                                          |
| 5 | toast           | region + timers                | a leaf; `mount` into a fixed host                                       |
| — | select/combobox | listbox + keyed options        | **deferred** — needs keyed lists (D8)                                   |

---

## 6. Non-goals & what would change them

- **No headless layer.** Adding one means every component exists twice (behavior + reference
  markup). Only worth it if the kit becomes a public library for other people's markup.
- **No button component.** Controls are styles (D9) — `components/base.css` plus a
  `button()` element helper. A `createButton()` view would double the sources of truth for what
  a button looks like and still miss every button the consumer writes into a slot. Only worth
  revisiting if a control ever grows real behavior (a menu button's aria wiring, say) — and then
  it is a component _around_ the classes, never instead of them.
- **No custom elements.** Light-DOM custom elements wrapping these factories would give
  attribute props and framework-agnostic use — a reasonable _outer shell_ later, never the
  foundation (it complicates the `enhance` story and adds a concept).
- **No keyed-list reconciler.** If select/combobox ever need it, the answer is a tiny
  identity-keyed mount helper discussed with vanilla's design doc, not a vdom.
- **No automatic style scoping.** `@scope` against the root class is the mechanism; it is
  explicit, native and free.
- **No slot/children system** beyond `Slot`. No named slots, no projection.
- **No a11y/browser-matrix guarantees.** Native elements carry most of it; the kit targets
  current evergreen browsers (`@scope`, `color-mix`, `<dialog>`, Popover API). CSS Anchor
  Positioning is the one place with a fallback (D10), because it is the one place where an
  evergreen browser still lacks the feature.
