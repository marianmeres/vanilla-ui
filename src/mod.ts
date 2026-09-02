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
	const [createDialog] = await Promise.all([loadDialog(base)]);
	return { createDialog };
}
