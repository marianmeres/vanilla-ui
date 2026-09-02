# @marianmeres/vanilla-ui — Agent Guide

Reusable UI primitives on top of `@marianmeres/vanilla`, shipped as **single-file `.html`
components** loaded at runtime. No build step for consumers. Authored for the author's own
vanilla-JS prototyping; published to JSR + npm.

## Quick Reference

- **Stack**: Deno · TypeScript index · plain-JS components inside `.html` · browser runtime.
- **Test**: `deno task test` (anatomy + index) · `deno task test:browser` (component behavior in
  headless Chrome) | **Type-check**: `deno check src/ tests/ scripts/`
- **Build**: `deno task build` (→ `dist/mod.js`, **tracked** — the file host import maps point at)
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
tests/browser/<name>.html — behavior test page per component (real Chrome, via scripts/browser-test.ts)
scripts/browser-test.ts   — serves the repo, drives headless Chrome (DevTools protocol), reads #result
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
   items (see 4 and 9).
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
   stacking, the anchor as the native invoker, CSS Anchor Positioning for placement — and JS
   only where the browser has none of it. If a primitive would need keyed list diffing, defer
   it (see DESIGN §6).
8. **Types live in `src/mod.ts`.** Components are plain JS; declare `<Name>Props`,
   `<Name>View`, `Create<Name>`, add `load<Name>()`, and extend `VanillaUi` + `loadAll()`.
9. **Controls belong to the base layer, never to a component.** Buttons and inputs are styles,
   not components (DESIGN §D9): `.vui-btn` + the five design-tokens roles
   (`--primary|accent|destructive|warning|success`) + `--ghost|--icon`, `.vui-input`,
   `.vui-field`, `.vui-row`, and the menu item — keyed on `role="menuitem"` inside a component,
   `.vui-menuitem` (+ `--destructive`) outside, laid out by `.vui-menu` — in
   `components/base.css`, plus a zero-specificity default so a **bare `<button>` inside any
   vui component** (a consumer's slot content) is styled too. A component may position a
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
   or `popover.html` for anything anchored to a trigger): `<style>` wrapped in
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

## Documentation Index

- [docs/DESIGN.md](./docs/DESIGN.md) — why shipped templates, tokens-with-fallbacks, `data-scope`,
  events, the base layer (§D9), the popover's platform-first split (§D10); component anatomy;
  roadmap; non-goals.
- [components/base.css](./components/base.css) — the vocabulary and the control primitives; its
  header comment is the reference for both.
- [README.md](./README.md) — overview, usage, theming, gallery.
- [API.md](./API.md) — loaders, per-component props / view / events / CSS variables.
- [gallery/index.html](./gallery/index.html) — worked host page (import map, theme switching,
  nested component, the reboot / layer picker).
- Base library: `/Users/mm/projects/@marianmeres/vanilla/docs/DESIGN.md` (local) ·
  [jsr.io/@marianmeres/vanilla](https://jsr.io/@marianmeres/vanilla).
