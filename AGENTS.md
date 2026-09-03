# @marianmeres/vanilla-ui — Agent Guide

Reusable UI primitives on top of `@marianmeres/vanilla`, shipped as **single-file `.html`
components** loaded at runtime. No build step for consumers. Authored for the author's own
vanilla-JS prototyping; published to JSR + npm.

## Quick Reference

- **Stack**: Deno · TypeScript index · plain-JS components inside `.html` · browser runtime.
- **Test**: `deno task test` (anatomy + index) · `deno task test:browser` (component behavior in
  headless Chrome) | **Type-check**: `deno check src/ tests/ scripts/`
- **Build**: `deno task build` (→ `dist/mod.js`, **tracked** — the file host import maps point at)
- **Prove a change is invisible**: `deno task fingerprint` → change → `deno task fingerprint
  --check` (rendered text + every bounding box; see `scripts/render-fingerprint.ts`)
- **Gallery**: `deno task serve` → http://localhost:4507/gallery/ (the kit's living test suite)
- **Themes**: `deno task themes:build` (→ `gallery/themes/*.css`) | **Release**: `deno task rp`

## Project Structure

```
src/mod.ts                — typed index: re-exports vanilla, COMPONENTS_BASE, loadAll/load<Name>, types
components/base.css       — the base layer: token vocabulary + control primitives (NOT a component)
components/<name>.html    — ONE component per file: <template> + @scope'd <style> + inline module
dist/mod.js               — built index (deno task build); tracked; import-map target
gallery/index.html        — every component, every state, every theme; import map example
gallery/themes/           — generated design-tokens CSS + reboot bridge ("vui-"); _generate.ts
gallery/reboot.css        — Bootstrap Reboot, vendored; the picker imports it into @layer reset
tests/components.test.ts  — anatomy lint of every components/*.html (linkedom, no browser)
tests/mod.test.ts         — index: URL resolution, re-exports
tests/browser/<name>.html — behavior test page per component, plus base.html for base.css on markup outside any component (real Chrome, via scripts/browser-test.ts)
scripts/browser-test.ts   — serves the repo, drives headless Chrome (DevTools protocol), reads #result
scripts/render-fingerprint.ts — captures what a page RENDERED (text + every box); --check diffs it
scripts/_chrome.ts        — the headless-Chrome harness both of the above sit on
docs/DESIGN.md            — rationale & rules (read before adding a component)
README.md · API.md        — human docs
```

## Critical Conventions

1. **Vanilla's principles apply** (see its `docs/DESIGN.md`): explicit dependencies, HTML lives in
   HTML (never build markup from strings — clone `<template>`s), use the platform, `track()`
   everything, stay small.
2. **Component anatomy is a contract** (enforced by `tests/components.test.ts`): file
   `components/<name>.html`; template `id="tpl-vui-<name>"`; template root has
   `class="vui-<name>"` **and** `data-scope="<name>"`; `<style>` rules wrapped in
   `@layer vui.components { @scope (.vui-<name>) { … } }`; exactly one `<script type="module">`
   that imports vanilla by **bare specifier** only and exports `create<Name>(props)`. The lint
   also fails raw `--vui-color-*` reads, unknown `--vui-*` names, color literals outside a
   `var()` fallback, and any paint declared on a control selector — buttons, inputs, menu
   items, summaries, tabs, switches (see 4 and 9). A component may ship **more than one** template
   (`tabs.html` clones a tab and a panel per entry) as long as every id is `tpl-vui-`-prefixed
   and `tpl-vui-<name>` is the root's.
3. **`data-scope` on every root.** It is vanilla's component boundary; without it nested
   components collide on `data-ref` names and `data-on` actions.
4. **Theming goes through the base vocabulary.** `components/base.css` reads every
   `--vui-color-*` token **once** and republishes it under **the token's name minus `color-`**
   with its canonical system-color fallback (`--vui-surface`, `--vui-surface-foreground`,
   `--vui-border`, `--vui-ring`, …; `foreground` is never abbreviated). Structural tokens sit
   beside them in tiers: `--vui-radius` / `-button` / `-container`, `--vui-shadow` / `-overlay`
   / `-dialog`, `--vui-border-width`, `--vui-transition`. A component aliases those
   (`--_bg: var(--vui-surface, Canvas)`) — never a raw token, never a name base doesn't
   declare. Add to the vocabulary rather than reaching around it. Never Tailwind / utility
   classes in templates.
5. **Events out, two ways.** Callback props (`onClose`) **and** a bubbling `CustomEvent` on the
   root named `vui:<event>` with a `detail` object.
6. **Containers take `Slot`s** (`string` → textContent, `HTMLElement` → placed, `ViewInstance`
   → `mount`ed and tracked). No general slot/children system.
7. **Platform first.** Native `<dialog>`, Popover API, `<details>` before any hand-rolled
   behavior. The popover is the worked example (DESIGN §D10): `popover="auto"` for dismiss and
   stacking, the anchor as the native invoker (it shows only a target that is in the document,
   so the popover places itself after the anchor — at creation if the anchor is connected, else
   on its first click, since a `createView` mountFn builds detached), CSS Anchor Positioning
   for placement — and JS only where the browser has none of it. Its `role: "menu"` and
   `role: "tooltip"` are **modes
   on that surface, not components** — as `placement` makes the dialog a drawer or a sheet
   (§D14). Before adding a component, check whether it is a prop or a mode on one that exists. The disclosure is the extreme case (§D11): the
   accordion is `<details name>`, the motion is `::details-content`, and there is no aria or
   keyboard glue at all. Tabs is the case with **no** element behind it (§D12) — so it is the
   wiring, and still leans on two platform pieces: `<button role="tab">` for Enter/Space, and
   `hidden="until-found"` panels, which keep an inactive panel findable (`beforematch` selects
   its tab). That last one is why every component's `[hidden]` rule — and base's own, which
   covers base markup outside any component; a component still needs its own, since a
   `display` in `vui.components` outranks `vui.base` whatever the specificity — must exclude
   `[hidden="until-found"]`. Toast is the one that is a **region**, not a widget (§D13):
   `popover="manual"` for the top layer — **re-entered on every `show()`**, since the layer is
   ordered by entry and a modal dialog opened after it would cover it — `aria-live` on the
   region for the announcement, and `@starting-style` for the entry. Its clock is a
   `setTimeout`, never the countdown bar's `animationend`: a page's reduced-motion reset must
   not decide when a toast leaves. A list is not a reconciler: tabs stamps an array once and
   a toast region only appends and removes, so neither approaches the no-reconciler boundary
   (see DESIGN §6, and §D8 for what actually defers select/combobox).
8. **Types live in `src/mod.ts`.** Components are plain JS; declare `<Name>Props`,
   `<Name>View`, `Create<Name>`, add `load<Name>()`, and extend `VanillaUi` + `loadAll()`.
9. **Controls belong to the base layer, never to a component.** Buttons and inputs are styles,
   not components (DESIGN §D9): `.vui-btn` + the five design-tokens roles
   (`--primary|accent|destructive|warning|success`) + `--ghost|--icon`, `.vui-input`,
   `.vui-field` (+ `.vui-help`, `[data-invalid]`, `:has(:user-invalid)`), `.vui-row`, the menu
   item — keyed on `role="menuitem"` inside a component, `.vui-menuitem` (+ `--destructive`)
   outside, laid out by `.vui-menu` — the `<summary>` row (keyed on the element; `.vui-summary`
   outside, caret and all), the tab (keyed on `role="tab"`; `.vui-tab` outside, in a
   `.vui-tablist` strip that ships in the same block because it draws the rail the indicator
   sits on), and the switch (keyed on `role="switch"` over a checkbox; `.vui-switch` outside) in
   `components/base.css`, plus a zero-specificity default so a **bare `<button>` inside any
   vui component** (a consumer's slot content) is styled too. Checkboxes, radios and ranges are
   **tinted, not drawn** — one `accent-color`, which is the other half of why the input rule
   must not `all: unset`. Not everything in base is a control: `.vui-badge`, `.vui-alert`,
   `.vui-card` and `.vui-table` are chrome and read no control context at all — nothing there
   hovers, focuses or presses. A component may position a
   control; it may not paint one — to adapt controls to
   its surface it re-declares the **context channel**
   (`--vui-control-bg|-foreground|-bg-hover|-bg-active|-border`, and the sizes
   `-min-height|-py|-px|-size`) **on itself** and lets them inherit — which is also all a button
   variant is, so a new role is five custom properties and no new rule. The channel is never
   declared at `:root` (its defaults are `var()` fallbacks at the usage sites, resolved at the
   control — a `:root` declaration would substitute eagerly and ignore the container); the lint
   enforces that too. Every component `<style>` is wrapped in `@layer vui.components` so a
   consumer's unlayered CSS wins without a specificity fight. `button(text, opts)` in the index
   builds one in JS; it returns an element, not a view. The corollary a host must know: a
   **reset** is unlayered CSS too, so Bootstrap Reboot loaded plainly beats `vui.base` — it
   belongs in a layer of its own, declared before `base.css` (`@layer reset, vui.base,
   vui.components;` + `@import url("reboot.css") layer(reset);`). The gallery's reboot
   picker shows both outcomes; API.md → Base layer documents it.
10. **One copy of vanilla.** `src/mod.ts` re-exports the base library so a host maps both bare
    specifiers to `dist/mod.js`. Don't import vanilla from anywhere but that specifier.

## Adding a Component

1. Create `components/<name>.html` following the anatomy in Convention 2 (copy `dialog.html`,
   `popover.html` for anything anchored to a trigger, `tabs.html` for anything built from a
   list of props, or `toast.html` for a region things are added to): `<style>` wrapped in
   `@layer vui.components { @scope (.vui-<name>) { … } }`, colors from the base vocabulary, no
   control painting (Convention 9).
2. Add types + `load<Name>()` to `src/mod.ts` (`await loadStyles(base)` first); extend
   `VanillaUi` and `loadAll()`.
3. Add `tests/browser/<name>.html` (copy `dialog.html`): one `ok`/`FAIL` line per check into
   `#result`, `DONE` last. Wait for native async events (a dialog's `close`, a popover's
   `toggle`) with a listener, never a timer. Geometry is measurable right after `open()` if
   the page sets `--vui-transition: 0ms` (see `tests/browser/popover.html`).
4. Add a `<section class="component" id="<name>">` to `gallery/index.html` covering every state.
   Use `.vui-btn` / `.vui-row` for any control it needs — the gallery defines no control styles
   of its own on purpose (it must test what ships).
5. `deno task test` (anatomy) · `deno task build` · `deno task test:browser` (behavior) ·
   `deno task serve` and eyeball the gallery, light and dark, at least two themes.
6. Document: README components table, API.md section (props, view, `returnValue`/events, CSS
   variables read), `mcp-include.txt` if the summary changes.

## Before Making Changes

- [ ] Read [docs/DESIGN.md](./docs/DESIGN.md) — principles, anatomy, roadmap, non-goals.
- [ ] Anything about buttons, inputs, colors or focus rings starts in `components/base.css` —
      one vocabulary, one control look, enforced by `tests/components.test.ts` (DESIGN §D9).
- [ ] Match `components/dialog.html` and the patterns in `src/mod.ts`.
- [ ] `deno task test`, `deno task test:browser` and `deno check src/ tests/ scripts/` pass.
- [ ] Component **behavior** is browser-only (blob-URL import + import map): the Deno unit tests
      only lint file anatomy and the index; `test:browser` runs `tests/browser/*.html` in headless
      Chrome (`$CHROME` overrides the binary path) and the gallery is for eyes.
- [ ] Rebuild `dist/mod.js` after touching `src/mod.ts` (it is tracked). The build task uses
      `--esbuild` on purpose: Deno's own bundler freezes `import.meta.url` into a `file://`
      string, which would break `COMPONENTS_BASE` in the browser.
- [ ] A dependency published < 24 h ago trips Deno's minimum-dependency-age policy; pass
      `--minimum-dependency-age 0` for that run rather than lowering it in `deno.json`.
- [ ] **`deno fmt` covers the `.html` files too** — the embedded `<style>` and `<script>`
      bodies included, which is why a component's inline module sits at column 0. The repo is
      clean (`deno fmt --check`); keep it that way, and keep a reformat out of a feature
      commit so it never buries the real diff.
- [ ] Changing something that should look **identical** afterwards (a reformat, a selector
      rewritten to mean the same thing, a base-layer refactor)? `deno task fingerprint`
      before, `deno task fingerprint --check` after. The browser tests check behavior; this
      is the one that checks layout, and it is what proved the HTML reformat was a no-op.

## Documentation Index

- [docs/DESIGN.md](./docs/DESIGN.md) — why shipped templates, tokens-with-fallbacks, `data-scope`,
  events, the base layer (§D9), the popover's platform-first split (§D10), why tabs takes an
  array where the menu takes markup (§D12), why a toast region is a list with no reconciler and
  why its variants tint rather than fill (§D13), why a drawer is a `placement` and not a
  component (§D14); component anatomy; roadmap; non-goals.
- [components/base.css](./components/base.css) — the vocabulary and the control primitives; its
  header comment is the reference for both.
- [README.md](./README.md) — overview, usage, theming, gallery.
- [API.md](./API.md) — loaders, per-component props / view / events / CSS variables.
- [gallery/index.html](./gallery/index.html) — worked host page (import map, theme switching,
  nested component, the reboot / layer picker).
- Base library: `/Users/mm/projects/@marianmeres/vanilla/docs/DESIGN.md` (local) ·
  [jsr.io/@marianmeres/vanilla](https://jsr.io/@marianmeres/vanilla).
