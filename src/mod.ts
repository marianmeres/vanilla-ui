/**
 * @marianmeres/vanilla-ui — reusable UI primitives on top of
 * [`@marianmeres/vanilla`](https://jsr.io/@marianmeres/vanilla), shipped as
 * **single-file `.html` components** (a `<template>`, a `@scope`d `<style>`, and the
 * factory in an inline `<script type="module">`), loaded at runtime with
 * `loadComponent`. No build step for the consumer — just serve.
 *
 * This module is the **typed index**. It does three things:
 *
 *   1. **Re-exports the base library** (`export * from "@marianmeres/vanilla"`). A
 *      host page maps BOTH bare specifiers — `@marianmeres/vanilla` and
 *      `@marianmeres/vanilla-ui` — to the one built file (`dist/mod.js`), so the
 *      components' own `import … from "@marianmeres/vanilla"` and the host's imports
 *      resolve to a **single copy** of vanilla (one scheduler, one everything).
 *   2. **Knows where the components live** — {@link COMPONENTS_BASE} is resolved from
 *      this module's own URL, so the kit works from wherever it is served (a sibling
 *      folder, a vendored copy, a CDN) with no configuration.
 *   3. **Loads them with types** — {@link loadAll} / {@link loadDialog} return the
 *      factories typed by the interfaces declared here (the `.html` files are plain
 *      JS; the types live in this file).
 *   4. **Installs the base style layer** ({@link loadStyles}, called by every loader)
 *      — `components/base.css`: the design-token vocabulary every component reads
 *      and the kit's control primitives (`.vui-btn`, `.vui-input`). Buttons are
 *      styles, not components; {@link button} builds one.
 *
 * The design rationale lives in `docs/DESIGN.md`.
 *
 * @module
 */
export * from "@marianmeres/vanilla";
import { loadComponent } from "@marianmeres/vanilla";
import type { ReadonlyObservable, ViewInstance } from "@marianmeres/vanilla";

/* ============================================================================
 * Locating the components
 * ========================================================================== */

/**
 * Absolute URL of the `components/` directory, resolved from **this module's
 * location** (`../components/` relative to `src/mod.ts` and to the built
 * `dist/mod.js` alike). Pass a different `base` to the loaders when the
 * components are served from somewhere else (a CDN, a vendored folder).
 */
export const COMPONENTS_BASE: string = new URL("../components/", import.meta.url).href;

/** Absolute URL of one component file: `componentUrl("dialog")` → `…/components/dialog.html`. */
export function componentUrl(name: string, base: string = COMPONENTS_BASE): string {
	return new URL(`${name}.html`, base).href;
}

/* ============================================================================
 * The base style layer — components/base.css
 * ========================================================================== */

/**
 * The id of the `<style>` element {@link loadStyles} injects. Put your own
 * element with this id in the document first — a `<link rel="stylesheet"
 * id="vui-base" href="…/components/base.css">` to avoid the fetch, or a wholly
 * replaced sheet — and the loader leaves it alone (the same skip-if-present rule
 * vanilla uses for template ids).
 */
export const BASE_STYLES_ID = "vui-base";

/** Absolute URL of the base stylesheet: `…/components/base.css`. */
export function baseStylesUrl(base: string = COMPONENTS_BASE): string {
	return new URL("base.css", base).href;
}

/** One document, one base layer — the id is the real guard; this just dedupes concurrent callers. */
let _stylesLoad: Promise<void> | undefined;

/**
 * Fetch `components/base.css` and install it as `<style id="vui-base">`,
 * **prepended** to `<head>`. Idempotent, and a no-op if an element with that id
 * is already in the document.
 *
 * Every `load<Name>()` awaits this before loading a component, for two reasons:
 * the components read the base **vocabulary** (`--vui-surface` &c., resolved from the
 * design tokens in one place), and the base sheet declares the cascade-layer
 * **order** (`@layer vui.base, vui.components;`) — which is why it must sit
 * ahead of the component styles vanilla appends to `<head>`.
 *
 * Call it yourself only to install the styles without loading any component
 * (a page that just wants `.vui-btn` and {@link button}).
 */
export function loadStyles(base: string = COMPONENTS_BASE): Promise<void> {
	if (_stylesLoad) return _stylesLoad;
	if (document.getElementById(BASE_STYLES_ID)) {
		return (_stylesLoad = Promise.resolve());
	}
	const url = baseStylesUrl(base);
	_stylesLoad = fetch(url)
		.then((r) => {
			if (!r.ok) {
				throw new Error(
					`vanilla-ui: cannot load base styles (${r.status} ${url}). ` +
						`components/base.css ships with the kit — copy the whole folder, ` +
						`or pass the right base to loadAll()/loadStyles().`,
				);
			}
			return r.text();
		})
		.then((css) => {
			if (document.getElementById(BASE_STYLES_ID)) return; // raced, or declared
			const style = document.createElement("style");
			style.id = BASE_STYLES_ID;
			style.textContent = css;
			document.head.prepend(style);
		});
	return _stylesLoad;
}

/* ============================================================================
 * Control primitives — see components/base.css
 * ========================================================================== */

/**
 * Paint of a {@link button}. `"default"` is the plain control; the rest are
 * `.vui-btn--*` classes. The five middle ones are the `@marianmeres/design-tokens`
 * semantic roles (each with its own hover/active/foreground tokens); `"ghost"` is a
 * treatment — no fill, borrows its container's foreground.
 */
export type ButtonVariant =
	| "default"
	| "primary"
	| "accent"
	| "destructive"
	| "warning"
	| "success"
	| "ghost";

/** Options of {@link button}. */
export interface ButtonOptions {
	/** Which `.vui-btn--*` paint. Default `"default"`. */
	variant?: ButtonVariant;
	/** Square + round, for a single glyph (`.vui-btn--icon`). */
	icon?: boolean;
	/** The `type` attribute. Default `"button"` — pass `"submit"` inside a `<form method="dialog">`. */
	type?: "button" | "submit" | "reset";
	/** The `value` attribute — a `<form method="dialog">` submit sets it as the dialog's `returnValue`. */
	value?: string;
	/** Disable it. */
	disabled?: boolean;
	/** `aria-label`, for an icon button whose text is a glyph. */
	ariaLabel?: string;
	/** Extra class names, appended. */
	class?: string;
	/** Click handler. It lives and dies with the element — there is no view to track. */
	onClick?: (e: MouseEvent) => void;
}

/**
 * Build a button element styled by the base layer.
 *
 *     footer: (() => {
 *       const row = document.createElement("div");
 *       row.className = "vui-row";
 *       row.append(
 *         button("Keep", { onClick: () => dlg.close("keep") }),
 *         button("Delete", { variant: "destructive", onClick: () => dlg.close("delete") }),
 *       );
 *       return row;
 *     })()
 *
 * Deliberately **not** a component and not a view: a button has no behavior, so
 * it needs no `data-scope`, no `track`, no `destroy`. It is markup plus the
 * classes from `components/base.css` — the same classes hand-written HTML uses,
 * so there is one source of truth for what a button looks like. Inside any vui
 * component a bare `<button>` gets that look anyway; this helper is for footers
 * and toolbars built in JS.
 *
 * Requires the base layer ({@link loadStyles}, awaited by every `load<Name>()`).
 */
export function button(label: string, opts: ButtonOptions = {}): HTMLButtonElement {
	const el = document.createElement("button");
	el.type = opts.type ?? "button";
	el.textContent = label;
	el.className = [
		"vui-btn",
		opts.variant && opts.variant !== "default" ? `vui-btn--${opts.variant}` : "",
		opts.icon ? "vui-btn--icon" : "",
		opts.class ?? "",
	].filter(Boolean).join(" ");
	if (opts.value != null) el.value = opts.value;
	if (opts.disabled) el.disabled = true;
	if (opts.ariaLabel) el.setAttribute("aria-label", opts.ariaLabel);
	if (opts.onClick) el.addEventListener("click", opts.onClick as EventListener);
	return el;
}

/* ============================================================================
 * Shared types
 * ========================================================================== */

/**
 * Content for a container's slot (a dialog body, a footer…). Three explicit kinds:
 *
 *   - `string`       — plain **text** (set via `textContent`; XSS-safe, never HTML)
 *   - `HTMLElement`  — a node you built (typically `fromTemplate(...)`) — placed as-is
 *   - `ViewInstance` — a child view; it is `mount`ed, so the container's `destroy()`
 *                      tears it down too
 */
export type Slot = string | HTMLElement | ViewInstance;

/* ============================================================================
 * dialog — components/dialog.html
 * ========================================================================== */

/** Props of {@link CreateDialog}. All optional. */
export interface DialogProps {
	/** Heading text. Omit for a headerless dialog (the close button stays unless `closeButton: false`). */
	title?: string;
	/** Main content — see {@link Slot}. */
	body?: Slot;
	/** Footer content (typically buttons) — see {@link Slot}. Omit to hide the footer. */
	footer?: Slot;
	/** `true` → `showModal()` (backdrop, focus trap, Esc); `false` → `show()`. Default `true`. */
	modal?: boolean;
	/** Close when the backdrop is clicked (modal only). Default `true`. */
	closeOnBackdrop?: boolean;
	/** Render the ✕ button in the header. Default `true`. */
	closeButton?: boolean;
	/**
	 * Called once per close with the dialog's `returnValue`: `"close"` (✕ or
	 * `close()`), `"cancel"` (Esc), `"backdrop"`, or whatever a
	 * `<form method="dialog">` submit button's `value` was.
	 */
	onClose?: (returnValue: string) => void;
}

/** The view returned by {@link CreateDialog}. */
export interface DialogView extends ViewInstance {
	/** The native `<dialog>` root (`data-scope="dialog"`). Mount it anywhere — the top layer takes care of stacking. */
	el: HTMLDialogElement;
	/** `true` between `open()` and the native `close` event. */
	isOpen: ReadonlyObservable<boolean>;
	/** Open it (`showModal()` or `show()` per `modal`). No-op if already open. */
	open(): void;
	/** Close it with a `returnValue` (default `"close"`). No-op if not open. */
	close(returnValue?: string): void;
}

/** The dialog factory exported by `components/dialog.html`. */
export type CreateDialog = (props?: DialogProps) => DialogView;

/** Load `components/dialog.html` and return its typed factory. Idempotent per URL. */
export async function loadDialog(base: string = COMPONENTS_BASE): Promise<CreateDialog> {
	await loadStyles(base);
	const mod = await loadComponent(componentUrl("dialog", base));
	return mod.createDialog as CreateDialog;
}

/* ============================================================================
 * All of it
 * ========================================================================== */

/** Every factory the kit ships, typed. What {@link loadAll} resolves to. */
export interface VanillaUi {
	createDialog: CreateDialog;
}

/**
 * Load every component (in parallel) and return the typed factories. One `await`
 * before mounting is the whole setup:
 *
 *     const { createDialog } = await loadAll();
 */
export async function loadAll(base: string = COMPONENTS_BASE): Promise<VanillaUi> {
	// first, and awaited: it declares the cascade layer ORDER the components' own
	// `@layer vui.components` blocks slot into
	await loadStyles(base);
	const [createDialog] = await Promise.all([loadDialog(base)]);
	return { createDialog };
}
