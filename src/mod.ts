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
 *   3. **Loads them with types** — {@link loadAll} / {@link loadDialog} /
 *      {@link loadPopover} / {@link loadDisclosure} / {@link loadTabs} /
 *      {@link loadToast} return the factories typed by the interfaces declared
 *      here (the `.html` files are plain JS; the types live in this file).
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
	/**
	 * The `role` attribute. `"menuitem"` makes it a menu item: inside a menu
	 * {@link CreatePopover popover} the keyboard reaches it, and the base layer
	 * paints it as one (by the role, over `.vui-btn`).
	 */
	role?: string;
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
	if (opts.role) el.setAttribute("role", opts.role);
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
 * popover — components/popover.html
 * ========================================================================== */

/**
 * Where a popover goes, relative to its anchor — the **preferred** side; it flips
 * when it would overflow the viewport. `start` / `end` align the popover's inline
 * edge with the anchor's; the bare side centers it.
 */
export type PopoverPlacement =
	| "bottom-start"
	| "bottom"
	| "bottom-end"
	| "top-start"
	| "top"
	| "top-end"
	| "left"
	| "right";

/** Props of {@link CreatePopover}. Only `anchor` is required. */
export interface PopoverProps {
	/**
	 * The trigger — usually a `<button>`, which becomes the native popover
	 * **invoker** (the browser toggles it on click and keyboard, and knows not to
	 * light-dismiss on it). Any other element gets a click listener. It receives
	 * `aria-expanded`, `aria-controls` and, for a `role` that warrants it,
	 * `aria-haspopup`.
	 */
	anchor: HTMLElement;
	/** Content — see {@link Slot}. For a menu: the items (see `role`). */
	body?: Slot;
	/** Preferred side. Default `"bottom-start"`. */
	placement?: PopoverPlacement;
	/** Gap from the anchor, in px. Default `4`. */
	offset?: number;
	/**
	 * The root's ARIA role, set as given. `"menu"` **also** switches on the menu
	 * behavior: the body's `[role="menuitem"]` elements (any of the three menuitem
	 * roles) get focus on open, ↑ ↓ Home End navigation, hover-to-focus, Tab-to-close,
	 * and activating one fires `onSelect` / `vui:select` and (by default) closes.
	 */
	role?: "menu" | "dialog" | "listbox" | (string & {});
	/** Clicking the anchor toggles. Default `true`. */
	trigger?: boolean;
	/** Menu only: activating an item closes the popover. Default `true`. */
	closeOnSelect?: boolean;
	/** Called after the native `toggle` event reports it open. */
	onOpen?: () => void;
	/** Called after the native `toggle` event reports it closed — whatever closed it. */
	onClose?: () => void;
	/**
	 * Menu only: an item was activated. `value` is the item's `value` attribute
	 * (else its `data-value`, else its text); `item` the element.
	 */
	onSelect?: (value: string, item: HTMLElement) => void;
}

/** The view returned by {@link CreatePopover}. */
export interface PopoverView extends ViewInstance {
	/**
	 * The `[popover="auto"]` root (`data-scope="popover"`). The factory inserts it
	 * right after a connected anchor (the native invoker needs it in the document);
	 * move it anywhere — the top layer handles stacking.
	 */
	el: HTMLElement;
	/** The anchor it was created with. */
	anchor: HTMLElement;
	/** `true` while shown. Settled synchronously by `open()`/`close()` and by the native `toggle` for every other route (light dismiss, Esc, the invoker). */
	isOpen: ReadonlyObservable<boolean>;
	/** Show it (`showPopover()`), inserting `el` after the anchor if it is not in the document. No-op if open. */
	open(): void;
	/** Hide it (`hidePopover()`). No-op if not open. */
	close(): void;
	/** One or the other. */
	toggle(): void;
}

/** The popover factory exported by `components/popover.html`. */
export type CreatePopover = (props: PopoverProps) => PopoverView;

/** Load `components/popover.html` and return its typed factory. Idempotent per URL. */
export async function loadPopover(
	base: string = COMPONENTS_BASE,
): Promise<CreatePopover> {
	await loadStyles(base);
	const mod = await loadComponent(componentUrl("popover", base));
	return mod.createPopover as CreatePopover;
}

/* ============================================================================
 * disclosure — components/disclosure.html
 * ========================================================================== */

/** Props of {@link CreateDisclosure}. All optional. */
export interface DisclosureProps {
	/** The header — see {@link Slot}. Rendered inside the native `<summary>`. */
	summary?: Slot;
	/** The panel — see {@link Slot}. */
	body?: Slot;
	/** Start expanded. Default `false`. */
	open?: boolean;
	/**
	 * The native **exclusive group**: give several disclosures the same `name` and
	 * the browser keeps at most one open — an accordion with no group component.
	 * Each one still settles its own state from its own `toggle`.
	 */
	name?: string;
	/** Called after the native `toggle` reports it open. */
	onOpen?: () => void;
	/** Called after the native `toggle` reports it closed — whatever closed it. */
	onClose?: () => void;
}

/** The view returned by {@link CreateDisclosure}. */
export interface DisclosureView extends ViewInstance {
	/** The native `<details>` root (`data-scope="disclosure"`). */
	el: HTMLDetailsElement;
	/** `true` while expanded. Settled synchronously by `open()`/`close()` and by the native `toggle` for every other route (the summary, find-in-page, an exclusive sibling). */
	isOpen: ReadonlyObservable<boolean>;
	/** Expand it. No-op if already open. */
	open(): void;
	/** Collapse it. No-op if already closed. */
	close(): void;
	/** One or the other. */
	toggle(): void;
}

/** The disclosure factory exported by `components/disclosure.html`. */
export type CreateDisclosure = (props?: DisclosureProps) => DisclosureView;

/** Load `components/disclosure.html` and return its typed factory. Idempotent per URL. */
export async function loadDisclosure(
	base: string = COMPONENTS_BASE,
): Promise<CreateDisclosure> {
	await loadStyles(base);
	const mod = await loadComponent(componentUrl("disclosure", base));
	return mod.createDisclosure as CreateDisclosure;
}

/* ============================================================================
 * tabs — components/tabs.html
 * ========================================================================== */

/** One tab of {@link TabsProps.tabs}: a label, its panel, and the identity tying them. */
export interface Tab {
	/**
	 * Identity — what {@link TabsView.selected} reports and what
	 * {@link TabsView.select} takes. Defaults to the tab's **index** as a string.
	 * Must be unique within one `tabs` array (a duplicate is dropped).
	 */
	value?: string;
	/** The tab itself — see {@link Slot}. Defaults to `value`. */
	label?: Slot;
	/** Its panel — see {@link Slot}. */
	panel?: Slot;
	/** Not selectable, and skipped by the arrow keys. Flip it later via {@link TabsView.tab}. */
	disabled?: boolean;
}

/** Props of {@link CreateTabs}. All optional. */
export interface TabsProps {
	/** The tabs, in order. Built once — the panels are static (there is no list diffing). */
	tabs?: Tab[];
	/** Which `value` starts selected. Default: the first enabled tab. */
	selected?: string;
	/** Which way the strip runs. Default `"horizontal"`. */
	orientation?: "horizontal" | "vertical";
	/**
	 * `"auto"` — the arrow keys select as they move (the ARIA pattern's default,
	 * and right for panels as cheap as these). `"manual"` — the arrows move focus
	 * only; Enter or Space selects. Default `"auto"`.
	 */
	activation?: "auto" | "manual";
	/** Accessible name for the `role="tablist"` strip. */
	ariaLabel?: string;
	/** Called on every change of selection — never for the initial one. */
	onSelect?: (value: string, tab: HTMLElement) => void;
}

/** The view returned by {@link CreateTabs}. */
export interface TabsView extends ViewInstance {
	/** The root (`data-scope="tabs"`), holding the strip and the panels. */
	el: HTMLElement;
	/** The selected tab's `value` (`""` if there is none). */
	selected: ReadonlyObservable<string>;
	/** Select a tab. No-op for an unknown, disabled, or already-selected `value`. */
	select(value: string): void;
	/** The `<button role="tab">` for a `value` — set `.disabled`, append a badge… */
	tab(value: string): HTMLElement | undefined;
	/** The `[role="tabpanel"]` for a `value` — fill it late, read it back. */
	panel(value: string): HTMLElement | undefined;
}

/** The tabs factory exported by `components/tabs.html`. */
export type CreateTabs = (props?: TabsProps) => TabsView;

/** Load `components/tabs.html` and return its typed factory. Idempotent per URL. */
export async function loadTabs(base: string = COMPONENTS_BASE): Promise<CreateTabs> {
	await loadStyles(base);
	const mod = await loadComponent(componentUrl("tabs", base));
	return mod.createTabs as CreateTabs;
}

/* ============================================================================
 * toast — components/toast.html
 * ========================================================================== */

/**
 * Where the toast rail sits. The block half is the physical side; the inline
 * half is logical (`start` / `end` follow the writing direction) — the same
 * vocabulary as {@link PopoverPlacement}.
 */
export type ToastPosition =
	| "top-start"
	| "top"
	| "top-end"
	| "bottom-start"
	| "bottom"
	| "bottom-end";

/**
 * Which design-tokens role tints a toast. It **tints** the surface (a 12% wash,
 * the role color on the edge, the icon and the countdown bar) rather than
 * filling it: the text keeps surface contrast on every theme, and one control
 * context serves every variant — see `docs/DESIGN.md` §D13.
 */
export type ToastVariant =
	| "primary"
	| "accent"
	| "destructive"
	| "warning"
	| "success";

/** Options of one toast — the second argument of {@link ToastView.show}. */
export interface ToastOptions {
	/** Tint it with a semantic role. Omit for the plain surface. */
	variant?: ToastVariant;
	/** This toast's life in ms; `0` makes it sticky. Default: the region's `ttl`. */
	ttl?: number;
	/**
	 * Identity. Showing the same `id` while it is still up bumps a `×N` badge and
	 * restarts its clock instead of stacking a second copy. Defaults to the
	 * message when the message is a string — so repeating `show("Saved")`
	 * dedupes with no bookkeeping — and to a fresh id otherwise.
	 */
	id?: string;
	/** A glyph before the message — see {@link Slot}. Takes the variant's color. */
	icon?: Slot;
	/** A control after it — see {@link Slot}. Typically {@link button}. */
	action?: Slot;
	/** Render the ✕. Default: the region's `closeButton`. */
	closeButton?: boolean;
}

/** The handle {@link ToastView.show} returns (and the callbacks receive). */
export interface ToastItem {
	/** Its identity — what {@link ToastView.dismiss} takes. */
	id: string;
	/** The toast element (`.vui-toast__item`). */
	el: HTMLElement;
	/** How many times this id has been shown while up. Read live. */
	readonly count: number;
	/** Dismiss it now. No-op once it is gone. */
	dismiss(): void;
}

/** Props of {@link CreateToast} — the region. All optional. */
export interface ToastProps {
	/** Which corner (or edge) the rail runs down. Default `"top-end"`. */
	position?: ToastPosition;
	/** Default life of a toast in ms; `0` makes them sticky. Default `4000`. */
	ttl?: number;
	/** Most toasts at once — the oldest is dismissed. `0` = no cap. Default `5`. */
	max?: number;
	/** Default for a toast's ✕. Default `true`. */
	closeButton?: boolean;
	/** Draw the countdown bar. Default `true`. */
	progress?: boolean;
	/** Accessible name for the region. */
	ariaLabel?: string;
	/** Called per `show()` — a repeat of a live id included (read `count`). */
	onShow?: (toast: ToastItem) => void;
	/** Called per dismissal, whatever caused it: the ✕, the clock, `dismiss()`, `clear()`, the cap. */
	onDismiss?: (toast: ToastItem) => void;
}

/** The view returned by {@link CreateToast}. */
export interface ToastView extends ViewInstance {
	/**
	 * The region (`data-scope="toast"`, `popover="manual"`). The first `show()`
	 * appends it to `<body>` if it is not in the document, and shows it in the
	 * **top layer** — so a toast is never buried by a modal dialog's backdrop or
	 * a page's `z-index`. Mount it yourself anywhere if you'd rather.
	 */
	el: HTMLElement;
	/** How many toasts are showing (a dismissed one leaves at once, before its exit plays). */
	count: ReadonlyObservable<number>;
	/** Put a message in the region. Returns its handle — the same one for a repeat of a live id. */
	show(message?: Slot, opts?: ToastOptions): ToastItem;
	/** Dismiss one by `id`. No-op for an unknown or already-dismissed one. */
	dismiss(id: string): void;
	/** Dismiss all of them (each reports, as its own dismissal). */
	clear(): void;
}

/** The toast factory exported by `components/toast.html`. */
export type CreateToast = (props?: ToastProps) => ToastView;

/** Load `components/toast.html` and return its typed factory. Idempotent per URL. */
export async function loadToast(base: string = COMPONENTS_BASE): Promise<CreateToast> {
	await loadStyles(base);
	const mod = await loadComponent(componentUrl("toast", base));
	return mod.createToast as CreateToast;
}

/* ============================================================================
 * All of it
 * ========================================================================== */

/** Every factory the kit ships, typed. What {@link loadAll} resolves to. */
export interface VanillaUi {
	createDialog: CreateDialog;
	createDisclosure: CreateDisclosure;
	createPopover: CreatePopover;
	createTabs: CreateTabs;
	createToast: CreateToast;
}

/**
 * Load every component (in parallel) and return the typed factories. One `await`
 * before mounting is the whole setup:
 *
 *     const { createDialog, createPopover } = await loadAll();
 */
export async function loadAll(base: string = COMPONENTS_BASE): Promise<VanillaUi> {
	// first, and awaited: it declares the cascade layer ORDER the components' own
	// `@layer vui.components` blocks slot into
	await loadStyles(base);
	const [createDialog, createDisclosure, createPopover, createTabs, createToast] =
		await Promise.all([
			loadDialog(base),
			loadDisclosure(base),
			loadPopover(base),
			loadTabs(base),
			loadToast(base),
		]);
	return { createDialog, createDisclosure, createPopover, createTabs, createToast };
}
