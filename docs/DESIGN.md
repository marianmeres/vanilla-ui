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

**A third check sits between the two.** Some changes are meant to be invisible — a reformat,
a selector rewritten to mean the same thing, a base-layer refactor — and neither a diff nor
the browser tests can settle that, because they check behavior, not layout. So
`scripts/render-fingerprint.ts` loads a page in headless Chrome and writes down what it
actually rendered: the body's text, the top layer's, and every element's tag, class and
bounding box to a tenth of a pixel. `deno task fingerprint` captures the baseline; `--check`
compares against it and prints the boxes that moved. Geometry and text rather than
screenshots, deliberately — no image diffing, no per-platform rendering noise, and a failure
you can read. The baseline lands in gitignored `tmp/` because it is a before/after pair inside
one piece of work, not a committed snapshot that would need regenerating every time the
gallery legitimately changes. It is worth anything only because it is deterministic: a fresh
browser profile per run (so the gallery's remembered theme cannot leak between them), a fixed
viewport, and a settle past the kit's longest transition. `scripts/_chrome.ts` is the DevTools
plumbing, shared with the browser suite.

Two lessons baked into the dialog test: native `<dialog>` fires `close` **asynchronously**, so
tests await the event, never a timer — and the component resets `returnValue` _after_ reading
it in that handler, not on `open()`, so a re-open can never race a pending close. And removing
an open dialog fires no `close` at all, so `destroy()` settles `isOpen` itself.

### D8 — Platform first, and wait where the platform is mid-flight

Native `<dialog>` gives the top layer, backdrop, focus trap, Esc and focus restore. The
Popover API gives light-dismiss. `<details>` gives disclosure. Each primitive should be mostly
chrome plus keyboard/aria glue — which is also the test for when _not_ to build one.

Select and combobox are the one place the platform has not arrived. A native `<select>` still
cannot be restyled the way the kit needs (customizable `<select>` / `appearance: base-select`
is shipping in Chromium and not yet everywhere), so a listbox built today means owning the
popup, the roving `aria-activedescendant`, typeahead, multi-select and form participation —
the largest component in the kit by a wide margin, and one that would be built a second time
if the native one lands. It is also the first primitive with a real _value_ model rather than
a boolean or an identity: something that round-trips with a form and is settable from outside,
which is a design conversation that has not happened. So it waits (§5) — and it costs little
while it does, because base.css already paints the native `<select>` (D9): a prototype's form
looks like the kit today.

An earlier version of this decision deferred them for a different reason — that they need
**keyed list rendering**, and would push vanilla toward a reconciler it deliberately does not
have. That was wrong, and D12 and D13 are why: tabs reads an array once and stamps clones,
toast appends to and removes from a `Map`, and a combobox would filter by toggling `hidden` on
options it rendered once — the same live read the popover's menu does over its items. The
no-reconciler boundary still stands (§6); it is simply not what is holding select back.

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
as `<style id="vui-base">`, prepended to `<head>`. It holds three things — the vocabulary, the
controls, and a little chrome.

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
  / `-bg-active` / `-border` (and the sizes: `-min-height`, `-py`, `-px`, and `-size` for a
  square icon button) **on itself**, and controls inherit. The dialog panel lifts everything
  inside it to `surface-1` in five lines:
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
  `color` to borrow the container's foreground on hover. `--icon` is the other treatment and
  declares no color at all: a square sized by `--vui-control-size`, for a single glyph like
  the dialog's ✕.
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

**The second control needs no key at all, and one exception.** Text inputs, selects and
textareas are painted by element inside a vui container, and by `.vui-input` outside one — and
they are the one control that does _not_ open with `all: unset`, because that would take the
`<select>`'s arrow and the checkbox and radio glyphs with it. This block paints and does
nothing else. What makes a `<select>` and a `<button>` the same height in a `.vui-row` is that
both read the same channel (`--vui-control-min-height`, `-py`), so a container that shrinks its
controls shrinks the whole row rather than half of it. The fill is its own vocabulary entry
(`--vui-input`, plus a hover) and not `surface`, because a field is its own color in every
generated theme — `Field` in the system fallback — and should read as a well, not as another
slab of the panel it sits on. It is also why the missing select component (D8, §5) costs so
little: the native one already looks like the kit.

The same exception decides its other half. A checkbox, a radio and a range are **tinted, not
drawn**: one `accent-color: var(--vui-primary)` puts the UA's own glyph on the theme, and that
glyph is already correct in both color schemes, at every zoom, with the platform's own hit area
and animation. Anything the kit drew instead would be a worse copy that has to be maintained.
So the reset that would have destroyed those glyphs is the reset this control does not do, and
the one property that themes them is the whole implementation.

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

**The fourth control is keyed on an element.** A `<summary>` inside a vui container is
painted as a row — full width, transparent at rest, hover and active from the channel, the
UA marker replaced by a caret that turns with its `<details>`'s `[open]`. Keyed on the
element because, unlike a `<button>`, a `<summary>` has exactly one shape it can take here;
`.vui-summary` is that look outside a container. Its focus ring is drawn inside, like the
menu item's, because the disclosure box clips itself to its radius. That the row belongs to
base and not to `components/disclosure.html` is D9's own argument applied a second time: a
plain `<details>` a consumer drops into a dialog body is markup the factory never sees, and
CSS reaches it anyway. The lint counts `summary` as a control, so no component can take it
back.

**The sixth control is keyed on a role, over an element the platform already finished.** A
switch is `<input type="checkbox" role="switch">`, and that markup arrives with the semantics,
the Space key, `:checked`, `disabled`, the form value and the announcement already correct — so
the kit draws a track and a knob and adds not one line of script. There is no `createSwitch`,
no `aria-checked` to keep in sync, and `el.checked = true` is the API, because it was always
the API. The knob moves on `inset-inline-start` rather than a `translate`, because the logical
property is direction-aware: the switch flips itself in RTL and still animates. And its resting
track is mixed off `--vui-foreground` rather than `--vui-muted` — a theme is free to put muted a
hair off its own surface (zinc does), and an OFF switch nobody can see is worse than no switch.
That last one is a rule, not a detail: a state that must be legible cannot be spent on a token a
theme is allowed to flatten.

**3. The chrome.** A badge, an alert, a card, a table, and the three layout classes (`.vui-row`,
`.vui-field`, `.vui-menu`). None of them is a control — nothing here hovers, focuses or presses
— so **none of them reads the control channel**, and a badge inside a dialog panel keeps the
color it was told to be while every button around it lifts to `surface-1`. They are here for the
reason the controls are, and the test is the same one: a card, a callout, a table and a labelled
field are markup a consumer writes as often as the kit does, and a factory can never reach it.
Four decisions worth keeping:

- **The alert is the toast's treatment (D13) standing still** — the same 12% wash of the role,
  the same tinted border, the role at full strength on the icon alone. Same recipe because it
  buys the same thing: a tinted box keeps ONE control context, so an alert holds a `.vui-btn` or
  a ghost ✕ with no per-role handling, and the text keeps surface contrast on every theme. Toast
  and alert are one visual idea with and without a timer, and the moment they are written twice
  they start to drift.
- **The table's header sticks only if an ancestor scrolls.** `position: sticky` and nothing else
  — no measurement, no clone row, no JS. Wrap it in an `overflow: auto` box and it works; leave
  it on the page and the rule is inert, which is the correct behavior, not a limitation. Sorting
  is behavior and is deliberately absent: it belongs to the page, or to `enhance`.
- **Zebra is mixed off the foreground**, for the switch track's reason above. A stripe some
  themes flatten into their own surface is a class that silently does nothing.
- **A field marks its error on the field, not the control.** `[data-invalid]` for something the
  browser cannot know (a server said so), and `:has(:user-invalid)` for the rest — the
  platform's own post-interaction state, never `:invalid`, which would open every empty required
  form in red. Both sit on the container, so a component can flag a field without painting a
  control (D9's rule holds even here).

The line this stops at is worth writing down, because this is exactly how a base layer becomes
the CSS framework D2 forbids: base paints markup a consumer writes and a factory cannot reach.
A card, an alert, a badge, a table and a field pass that test. A skeleton, an avatar, a
breadcrumb and a spacing scale do not — they are decoration nobody's slot content depends on,
and they are not coming.

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

**Tooltip is the second mode, and mostly a list of things it is not.** The expensive half of a
tooltip is placement — anchor positioning, the try-fallbacks, the JS path for browsers without
them — and that was paid for above. What is left is triggering and aria, about forty lines. It
is a mode for the same reason the menu is: a separate `tooltip.html` would have to restate the
placement whole, because components import only vanilla and cross-file composition does not
exist (§3).

Four differences from every other popover, each of them the point:

- **`popover="hint"`, not `auto`.** Hint is the state the platform added for exactly this: it
  light-dismisses and takes Esc, but it does not close an open auto popover — so a tip on a
  button inside a menu does not shut the menu. Where hint does not exist the attribute is
  invalid and reflects back as `manual`, which is the right fallback anyway, since the hover and
  focus wiring is what opens and closes it. (Contrast D10's all-or-nothing anchor-positioning
  check: here the degraded path is the same tooltip with one less dismissal route, so there is
  nothing to detect.)
- **The anchor is _described_, not expanded.** `aria-describedby`, and neither `aria-expanded`
  nor `aria-controls` — a tooltip is not a widget its anchor expands, and every other mode's
  aria would be a lie a screen reader repeats.
- **No invoker.** The native invoker relationship is a _toggle_ — the thing this mode
  specifically does not do. So the anchor gets hover and focus listeners instead, and only
  `:focus-visible` counts: Chrome focuses a `<button>` on click and Safari does not, so
  listening to plain `focus` would strand a tip behind a click in one browser and not the other.
  The platform already computes that distinction; the kit just asks.
- **`pointer-events: none`, as a design decision.** A tooltip the pointer can enter is a popover
  somebody mislabelled. Making it physically unreachable is what keeps `aria-describedby`
  honest — text goes in and nothing else _can_ — and it removes the whole "keep it open while
  the pointer travels to it" apparatus that only exists to serve content that should not be
  there. The cost is real and accepted: no link inside a tooltip, ever.

Tooltips are the most-abused a11y primitive there is, and shipping one is a defensible choice
only because the alternative here is every prototype hand-rolling a worse one. The constraints
above are what make it defensible; loosening them would not be a feature.

### D11 — Disclosure: the platform _is_ the component

The third primitive is the one where "mostly platform" (D8) is nearly literal.
`<details>`/`<summary>` already give the toggle, the keyboard, `aria-expanded`, the open
state as an attribute, and find-in-page expanding a closed section to show a hit — so unlike
the dialog and the popover this component adds **no** aria or keyboard glue at all. What is
left is a box, an `isOpen` observable and the events out. Three decisions inside that:

- **The accordion is an attribute.** Stuic's Accordion is a group component: a context, a
  registry of items, a `notifyOpen` that closes the others. `<details name="faq">` is all of
  that, in the browser — and better, because each view still settles its own state from its
  own `toggle`, so there is no cross-component wiring to get wrong and a consumer's plain
  `<details name="faq">` joins the same group without knowing the kit exists. The `name` prop
  is one `setAttribute`; there is no group component and no `exclusive` flag, and there will
  not be one.

- **The panel's motion is `::details-content`.** The grid `0fr → 1fr` wrapper (stuic's, and
  every accordion's before the pseudo-element existed) needs two extra elements and still
  cannot be addressed from outside. The kit transitions the platform's own pseudo-element:
  `block-size: 0 → auto` made interpolable by `interpolate-size: allow-keywords`, plus a
  discrete `content-visibility` transition so the panel stays rendered while it collapses. No
  wrapper, no measurement, no JS. Support needs no `@supports` and no fallback either: a
  browser without the pseudo-element drops the rules whole and snaps open — which is what a
  bare `<details>` does anyway. (Contrast the popover, D10, where the missing feature would
  have left a _broken_ box, not a plainer one.)

- **The events report a change, not a state.** `toggle` is the single source of truth, as the
  dialog's `close` and the popover's `toggle` are: `open()`/`close()` mirror it synchronously
  and every other route — the summary, find-in-page, an exclusive sibling being closed _by_
  the browser — arrives there. But an `open: true` at creation queues a `toggle` of its own,
  so the view remembers the state it was created in and stays quiet about it. Nothing fires
  for a state the consumer wrote.

There is deliberately no `disabled` prop: the platform has no disabled `<details>`, and faking
one is JS plus CSS for a state a prototype can express by not rendering the section.

### D12 — Tabs: an array, because a tab is a pair

The fourth primitive is the first one the platform has **no element for**, and the first
that takes a list. Both are worth saying out loud.

- **It takes `tabs: Tab[]`, and D10's "items are markup" still stands.** A menu item is one
  element with a role, so the popover can query markup the consumer writes anyway. A tab is
  a **pair** — a label in the strip and a panel below it — and the association between them
  (`id`, `aria-controls`, `aria-labelledby`, which one is showing) is exactly the glue the
  component exists to write. There is no markup a consumer already has that carries it, so
  asking for it would mean asking them to hand-author the aria and then having the component
  check it. The array is read **once**, at creation; nothing is diffed, nothing is keyed, and
  the panels are static — which is the promise the roadmap made and the reason the no-reconciler
  boundary (§6) is not in play. (Stuic's `TabbedMenu` is items-driven too, but it is only the
  strip: it reports a `value` and leaves the panels to the page. Owning
  both is what buys the pairing, and it is the whole difference between the two components.)

- **The tab is the fifth base control (D9), keyed on `role="tab"`.** Same move as the menu
  item, one primitive later: `components/tabs.html` gives its tabs **no class at all**, and
  `components/base.css` paints them — with `.vui-tab` / `.vui-tablist` for a hand-written
  strip outside a component (a nav of `<a>`s that reads as tabs needs no factory). The strip
  comes with it, in the same block, because the two are one idea: the strip draws the rail
  and a selected tab's indicator sits **on** that rail, covering it, and splitting them means
  lining the two up again in every future tab strip. The strip **scrolls** rather than wraps
  so the rail stays one unbroken line — which is also why a tab's focus ring is drawn inside,
  as the menu item's and the summary's are, and why the strip draws its rail **inside** its
  own padding box (an inset shadow) rather than as a border under it: `overflow-x: auto`
  scrolls the block axis too, so a tab reaching a pixel past the strip to cover a border is a
  pixel to scroll, and the strip grows a scrollbar down its side and clips the indicator. The lint counts `[role="tab"]` and `.vui-tab` as
  controls, so no component can take them back.

- **A panel that is not showing is still findable.** An inactive panel is
  `hidden="until-found"`, not `hidden`: Ctrl+F for a word in a tab you are not looking at and
  the browser reveals the panel, fires `beforematch`, and the component selects that tab.
  That is the disclosure's find-in-page story (D11) bought a second time, for ~5 lines and
  one listener. Three consequences, all deliberate: a panel carries **no padding of its own**
  (the container holds it) because a `hidden-matchable` box is _rendered_, just skipped, and
  padding would leave a band of empty space per inactive tab; the panel of a **disabled** tab
  is plainly `hidden`, since a hit there would reveal a panel no tab can select; and the
  three older components' `:scope [hidden] { display: none }` — written for a hidden ✕, but
  reaching every descendant — became `:not([hidden="until-found"])`, exactly the exception the
  UA's own rule makes. A browser without the feature reads the value as a plain `hidden` and
  the panel is simply hidden, which is what it would have been anyway (contrast the popover,
  D10, where the missing feature would have left a _broken_ box).

- **Selection follows focus, unless it shouldn't.** `activation: "auto"` (the default) selects
  as the arrow keys move, which is what the ARIA pattern recommends for panels this cheap;
  `"manual"` moves focus only and lets Enter or Space — the `<button>`'s own, no glue —
  select. The roving `tabindex` follows the **selection**, not the focus: one stop leads into
  the strip and it is the selected tab, and an arrowed-to tab is focusable at `-1` regardless.

- **`disabled` is read off the element, every time.** `tabs.tab("x").disabled = true` takes a
  tab out of the keyboard order and out of `select()` from that moment, with nothing to
  re-render and no second copy of the state — the same live read the popover's menu does over
  its items. What it does not do is move the selection: the component changes nothing behind
  the consumer's back.

### D13 — Toast: a region, and a list without a reconciler

The fifth primitive is the first that is a **region** rather than a widget: `createToast()`
builds a rail, and every `show()` puts one message in it. That inversion decides the rest.

- **It is a list, and D8 still holds.** A toast region only ever appends and removes; nothing
  is ever re-rendered from a model, so there is no diffing and no keys — the no-reconciler
  line (§6) is not crossed, it is simply not approached. What tabs took as an array (D12)
  this one takes one call at a time, because the messages arrive one at a time. The
  only list state is a `Map` of live toasts, and it exists for two features that need
  identity: the repeat badge and the capacity cap.

- **The top layer, re-entered on every toast.** `popover="manual"` — no light dismiss, no Esc,
  no invoker; the top layer and nothing else. A `position: fixed` rail loses to a modal
  `<dialog>`'s backdrop and to any `z-index` on the page, and the top layer is ordered by
  entry, so a dialog opened _after_ the region would still cover it. Hence `show()` re-enters
  the layer (hide, then show) whenever the region is already up — unless focus is inside it,
  since hiding a popover moves focus and a reader on the ✕ keeps it. What this does **not**
  buy is interactivity: a modal dialog makes everything outside it inert, so while one is open
  a toast is visible but its ✕ is not clickable. That is the platform's call, it is pinned by
  a browser test, and it is the right one — the modal is modal.

- **The clock is a `setTimeout`; the countdown bar is a CSS animation.** Driving the dismissal
  from the bar's `animationend` would be one source of truth and is very tempting — but it
  hands the behavior to the page's stylesheet, and the most common reduced-motion reset in the
  wild (`*, *::before, *::after { animation-duration: 0.01ms !important }`) would make every
  toast vanish on arrival, while a blunter `animation: none` would make none of them leave.
  So the bar is decoration and the timeout is the clock. They agree because they pause
  together: hover or focus anywhere in the region sets `data-paused`, the script holds the
  timeouts off it and the CSS holds the bars off the same attribute.

- **The variant tints the surface; it does not fill it.** Stuic's Notifications paint the whole
  box in the role color, which is the stronger signal. Here the box stays a surface with a 12%
  wash of the role, its border tinted to match, and the role at full strength only on the icon
  and the countdown bar — because a
  filled toast holds _controls_ (a ✕, an Undo) and D9 says a container adapts controls by
  re-declaring `--vui-control-*` on itself: a filled box would need its own context per role,
  and the ghost ✕'s resting color could not follow it at all (it is declared on the element).
  A tinted box keeps ONE context — the dialog panel's, verbatim — so the ✕ _is_ the dialog's ✕
  and an action button _is_ a dialog footer button. Legibility comes free with it: the text
  stays at surface contrast on every theme, with no white-on-amber to check.

- **Identity defaults to the message.** Stuic hashes the content into an id; here the id is
  simply the text (a `Map` key can be a string), so `show("Saved")` twice is one toast with a
  `×2` badge and a restarted clock, with nothing for the consumer to know. Anything that is
  not a string gets a fresh id, and an explicit `id` overrides both. Over capacity the
  **oldest** goes, so a runaway loop cannot push the rail off screen.

- **`@starting-style` is the entry.** No keyframes, no "added" class, no scheduling: the style
  the browser starts from the first time it lays the toast out. The exit is the same two
  properties under `[data-exiting]`, and the node is removed on `transitionend` — or by a net
  whose length is read off the box, because a page with no transitions at all fires no
  `transitionend` and the node still has to go.

There is deliberately no icon set (the kit has no icon story; `icon` is a `Slot` like every
other), no length-scaled TTL, and no queue behind the cap: a toast that never got shown is a
toast that no longer matters.

---

### D14 — The drawer is a prop, not a component

A drawer and a bottom sheet are what a prototype reaches for after the dialog: a mobile nav, a
filter panel, a detail pane. Every kit ships them as their own components. Here they are one
prop on the dialog, `placement`, and the reason is D8 read carefully: the expensive parts of a
drawer are the top layer, the focus trap, Esc, focus restore and the backdrop, and `<dialog>`
already gave all five to the dialog. What is actually different between a modal and a drawer is
which edge the box is pinned to and which way it arrives — margins, sizes and one keyframe.

A separate `drawer.html` would have had to restate all of it (components import only vanilla;
cross-file composition does not exist, by the anatomy contract in §3), and then keep two copies
of the return-value convention, the slot filling and the close plumbing in step forever. The
same argument that made "menu" a _mode_ of the popover (D10) makes "drawer" a _placement_ of the
dialog. `modal` was already there and composes with it for free: an edge placement with
`modal: false` is a side panel you can still work around.

Three details are load-bearing:

- **`position: fixed`, declared.** The UA stylesheet makes a modal `<dialog>` fixed and a
  non-modal one `absolute`. Inherit that and a non-modal drawer hangs off its nearest positioned
  ancestor instead of the viewport — which is exactly the case the prop exists to serve, so the
  component states the position rather than accepting the platform's split. This is the one
  place in the file where the platform's default is deliberately overridden, and it is pinned by
  a browser test that puts a non-modal drawer inside a `position: relative` box.
- **The edges are logical, the slide with them.** `start` / `end` rather than left / right, with
  the margins, the corner radii and the `--_slide` custom property all following the document
  direction (`:dir(rtl)` flips the last one). One keyframe reads `--_slide` off the element, so
  four edges and both directions cost one animation, not five.
- **`box-sizing: border-box` on the root.** Found by the test that asserts a sheet is exactly as
  wide as the viewport: the dialog's own 1px border was pushing `width: 100vw` two pixels past
  it, and had been quietly doing the same to `min(32rem, …)` since the first commit. A stated
  width should be the width.

There is deliberately no `size` prop and no resizing. A prototype that needs a wider drawer sets
a width on `.vui-dialog` — which is CSS the consumer already owns, unlayered, and wins for free
(D9).

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

Rules the test enforces: template ids start with `tpl-vui-` (a component may ship **more than
one** — `tabs.html` clones a tab and a panel per entry — as long as `tpl-vui-<name>` is the
root's); the root has both the class and `data-scope`; every `<style>` is `@scope`d to the root class **and** wrapped in
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

| # | Component       | Built on                       | Notes                                                                            |
| - | --------------- | ------------------------------ | -------------------------------------------------------------------------------- |
| 1 | dialog          | `<dialog>`                     | ✅ shipped — `placement` makes it a drawer or a sheet, same component (D14)      |
| 2 | popover         | Popover API (`popover="auto"`) | ✅ shipped — one component; `role: "menu"` and `role: "tooltip"` are modes (D10) |
| 3 | disclosure      | `<details>` / `<summary>`      | ✅ shipped — `name` is the accordion, `::details-content` the motion (D11)       |
| 4 | tabs            | roving `tabindex`, aria-tabs   | ✅ shipped — a tab is a base control; `hidden=until-found` panels (D12)          |
| 5 | toast           | region + timers                | ✅ shipped — a rail in the top layer; append-and-remove, no diffing (D13)        |
| — | select/combobox | listbox + popup                | **deferred** — no platform element yet, and a value model to design (D8)         |

The five are shipped and nothing is queued behind them, so this is a record more than a plan.
The deferred row is the only open question, and D8 says what would reopen it: a native
`<select>` that can be restyled everywhere the kit runs. Until then base.css paints the
native one and a prototype's form is fine without a component.

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
- **No keyed-list reconciler.** Nothing has needed one yet, select and combobox included
  (D8): tabs stamps an array once, toast appends and removes, and a filtered list is
  `hidden` toggled on options rendered once. If a component ever does need it, the answer is
  a tiny identity-keyed mount helper discussed with vanilla's design doc, not a vdom.
- **No automatic style scoping.** `@scope` against the root class is the mechanism; it is
  explicit, native and free.
- **No slot/children system** beyond `Slot`. No named slots, no projection.
- **No a11y/browser-matrix guarantees.** Native elements carry most of it; the kit targets
  current evergreen browsers (`@scope`, `color-mix`, `<dialog>`, Popover API). CSS Anchor
  Positioning is the one place with a fallback (D10), because it is the one place where an
  evergreen browser still lacks the feature.
