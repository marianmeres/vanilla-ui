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
components/<name>.html    — ONE component per file: <template> + @scope'd <style> + inline module
dist/mod.js               — built index (deno task build); tracked; import-map target
gallery/index.html        — every component, every state, every theme; import map example
gallery/themes/           — generated design-tokens CSS (prefix "vui-"); _generate.ts
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
   `@scope (.vui-<name>) { … }`; exactly one `<script type="module">` that imports vanilla by
   **bare specifier** only and exports `create<Name>(props)`.
3. **`data-scope` on every root.** It is vanilla's component boundary; without it nested
   components collide on `data-ref` names and `data-on` actions.
4. **Theming = tokens with fallbacks.** Read `--vui-color-*` (design-tokens, prefix `vui-`) via
   local aliases with **system-color fallbacks** (`Canvas`, `CanvasText`, `GrayText`,
   `Highlight`), so a component renders correctly with no theme loaded. Never Tailwind /
   utility classes in templates.
5. **Events out, two ways.** Callback props (`onClose`) **and** a bubbling `CustomEvent` on the
   root named `vui:<event>` with a `detail` object.
6. **Containers take `Slot`s** (`string` → textContent, `HTMLElement` → placed, `ViewInstance`
   → `mount`ed and tracked). No general slot/children system.
7. **Platform first.** Native `<dialog>`, Popover API, `<details>` before any hand-rolled
   behavior. If a primitive would need keyed list diffing, defer it (see DESIGN §6).
8. **Types live in `src/mod.ts`.** Components are plain JS; declare `<Name>Props`,
   `<Name>View`, `Create<Name>`, add `load<Name>()`, and extend `VanillaUi` + `loadAll()`.
9. **One copy of vanilla.** `src/mod.ts` re-exports the base library so a host maps both bare
   specifiers to `dist/mod.js`. Don't import vanilla from anywhere but that specifier.

## Adding a Component

1. Create `components/<name>.html` following the anatomy in Convention 2 (copy `dialog.html`).
2. Add types + `load<Name>()` to `src/mod.ts`; extend `VanillaUi` and `loadAll()`.
3. Add `tests/browser/<name>.html` (copy `dialog.html`): one `ok`/`FAIL` line per check into
   `#result`, `DONE` last. Wait for native async events (a dialog's `close`) with a listener,
   never a timer.
4. Add a `<section class="component" id="<name>">` to `gallery/index.html` covering every state.
5. `deno task test` (anatomy) · `deno task build` · `deno task test:browser` (behavior) ·
   `deno task serve` and eyeball the gallery, light and dark, at least two themes.
6. Document: README components table, API.md section (props, view, `returnValue`/events, CSS
   variables read), `mcp-include.txt` if the summary changes.

## Before Making Changes

- [ ] Read [docs/DESIGN.md](./docs/DESIGN.md) — principles, anatomy, roadmap, non-goals.
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
  events; component anatomy; roadmap; non-goals.
- [README.md](./README.md) — overview, usage, theming, gallery.
- [API.md](./API.md) — loaders, per-component props / view / events / CSS variables.
- [gallery/index.html](./gallery/index.html) — worked host page (import map, theme switching,
  nested component).
- Base library: `/Users/mm/projects/@marianmeres/vanilla/docs/DESIGN.md` (local) ·
  [jsr.io/@marianmeres/vanilla](https://jsr.io/@marianmeres/vanilla).
