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

**In:** shipped single-file components (template + scoped style + factory), a typed index
that loads them, design-tokens theming with graceful fallbacks, nesting via `data-scope`,
events out, a gallery.

**Out (deliberately):** a headless/behavior-only layer, custom elements, a keyed-list
reconciler, automatic style scoping, Tailwind in templates, a slot/children system beyond
`Slot`. See §6.

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
local aliases that fall back to **system colors**:

```css
:scope {
	--_bg: var(--vui-color-surface, Canvas);
	--_fg: var(--vui-color-surface-foreground, CanvasText);
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
	@scope (.vui-<name>) {
		:scope { --_bg: var(--vui-color-…, <system color>); … }
		…
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
`data-scope`; every `<style>` is `@scope`d to the root class; exactly one module script; it
imports vanilla by bare specifier and nothing by relative path; it exports `create<Name>`; it
never assigns `innerHTML`.

Rules the test cannot enforce (review them): props are the single argument with defaults;
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

| # | Component       | Built on                       | Notes                                                                        |
| - | --------------- | ------------------------------ | ---------------------------------------------------------------------------- |
| 1 | dialog          | `<dialog>`                     | ✅ shipped                                                                   |
| 2 | menu / popover  | Popover API (`popover="auto"`) | light-dismiss native; anchor positioning where supported, fallback otherwise |
| 3 | disclosure      | `<details>` / `<summary>`      | mostly styling + an `isOpen` observable                                      |
| 4 | tabs            | roving `tabindex`, aria-tabs   | static panels; no list diffing                                               |
| 5 | toast           | region + timers                | a leaf; `mount` into a fixed host                                            |
| — | select/combobox | listbox + keyed options        | **deferred** — needs keyed lists (D8)                                        |

---

## 6. Non-goals & what would change them

- **No headless layer.** Adding one means every component exists twice (behavior + reference
  markup). Only worth it if the kit becomes a public library for other people's markup.
- **No custom elements.** Light-DOM custom elements wrapping these factories would give
  attribute props and framework-agnostic use — a reasonable _outer shell_ later, never the
  foundation (it complicates the `enhance` story and adds a concept).
- **No keyed-list reconciler.** If select/combobox ever need it, the answer is a tiny
  identity-keyed mount helper discussed with vanilla's design doc, not a vdom.
- **No automatic style scoping.** `@scope` against the root class is the mechanism; it is
  explicit, native and free.
- **No slot/children system** beyond `Slot`. No named slots, no projection.
- **No a11y/browser-matrix guarantees.** Native elements carry most of it; the kit targets
  current evergreen browsers (`@scope`, `color-mix`, `<dialog>`, Popover API).
