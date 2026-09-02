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

**Returns:** `Promise<VanillaUi>` — `{ createDialog }`.

**Example:**

```ts
const { createDialog } = await loadAll();
```

---

### `loadDialog(base?)`

Load `components/dialog.html` alone and return its typed factory.

**Parameters:**

- `base` (`string`, optional) — as in `loadAll`.

**Returns:** `Promise<CreateDialog>`.

---

### `componentUrl(name, base?)`

Absolute URL of one component file.

**Parameters:**

- `name` (`string`) — the component name (`"dialog"`).
- `base` (`string`, optional) — Default: `COMPONENTS_BASE`.

**Returns:** `string` — e.g. `…/components/dialog.html`.

---

## Constants

### `COMPONENTS_BASE`

`string` — Absolute URL of the `components/` directory, resolved as `../components/` relative
to the index module's own URL (`src/mod.ts` in Deno, `dist/mod.js` in the browser). This is
why the kit needs no path configuration when served as a folder.

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

**CSS variables read** (all with system-color fallbacks):

`--vui-color-surface`, `--vui-color-surface-foreground`, `--vui-color-surface-1` (hairlines),
`--vui-color-muted-foreground`, `--vui-color-ring`, `--vui-radius`.

**Example:**

```ts
const dlg = createDialog({
	title: "Delete 3 items?",
	body: "This cannot be undone.",
	closeOnBackdrop: false,
	footer: buttons, // an element holding <button>s that call dlg.close("delete") etc.
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

## Types

### `Slot`

```ts
type Slot = string | HTMLElement | ViewInstance;
```

Content for a container's slot. `string` is **text** (`textContent`, never HTML); an element
is placed as-is; a view is `mount`ed so the container's `destroy()` tears it down too.

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

### `VanillaUi`

```ts
interface VanillaUi {
	createDialog: CreateDialog;
}
```

What `loadAll()` resolves to. Grows with every component.
