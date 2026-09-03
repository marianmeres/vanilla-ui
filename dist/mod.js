// https://jsr.io/@marianmeres/vanilla/1.9.0/src/vanilla.ts
var MAX_UPDATE_DEPTH = 1e3;
var Scheduler = /* @__PURE__ */ (() => {
  const queues = {
    microtask: {
      map: /* @__PURE__ */ new Map(),
      scheduled: false,
      arm: (cb) => queueMicrotask(cb)
    },
    raf: {
      map: /* @__PURE__ */ new Map(),
      scheduled: false,
      arm: (cb) => requestAnimationFrame(cb)
    }
  };
  let flushing = false;
  let chainDepth = 0;
  function flush(kind) {
    const q = queues[kind];
    const entries = q.map;
    q.map = /* @__PURE__ */ new Map();
    q.scheduled = false;
    flushing = true;
    try {
      entries.forEach((read, fn) => fn(read()));
    } finally {
      flushing = false;
    }
  }
  function enqueue(fn, kind, read) {
    const q = queues[kind] ?? queues.microtask;
    const arming = !q.scheduled;
    if (arming) {
      if (flushing) {
        if (++chainDepth > MAX_UPDATE_DEPTH) {
          chainDepth = 0;
          throw new Error(
            `vanilla: maximum update depth exceeded (${MAX_UPDATE_DEPTH}) \u2014 likely a feedback loop where an effect's set() retriggers itself (a writes b, b writes a, \u2026). Check your reactTo/computed wiring, or make the loop converge so the equality guard can stop it.`
          );
        }
      } else {
        chainDepth = 0;
      }
    }
    q.map.set(fn, read);
    if (arming) {
      q.scheduled = true;
      q.arm(() => flush(kind));
    }
  }
  return { enqueue };
})();
var computing = 0;
function withinCompute(calc) {
  computing++;
  try {
    return calc();
  } finally {
    computing--;
  }
}
function observable(value) {
  const subs = /* @__PURE__ */ new Map();
  function notify() {
    subs.forEach((kind, fn) => Scheduler.enqueue(fn, kind, () => value));
  }
  const self = {
    get: () => value,
    set(v) {
      if (computing > 0) {
        throw new Error(
          "vanilla: cannot set() an observable from inside a computed's calc \u2014 calc must be a pure derivation of its sources (no writes / side effects). Move the write into a reactTo(...) effect."
        );
      }
      if (v === value) return;
      value = v;
      notify();
    },
    update(fn) {
      self.set(fn(value));
    },
    subscribe(fn, { immediate = true, scheduler = "microtask" } = {}) {
      subs.set(fn, scheduler);
      if (immediate) fn(value);
      return () => {
        subs.delete(fn);
      };
    }
  };
  return self;
}
function reactTo(sources, fn, { immediate = true, scheduler = "microtask" } = {}) {
  const unsubs = sources.map((o) => o.subscribe(fn, { immediate: false, scheduler }));
  if (immediate) fn();
  return () => unsubs.forEach((u) => u());
}
function computed(sources, calc, { scheduler = "microtask" } = {}) {
  const out = observable(withinCompute(calc));
  reactTo(sources, () => out.set(withinCompute(calc)), { immediate: false, scheduler });
  return {
    get: out.get,
    subscribe: out.subscribe
  };
}
function fromTemplate(id) {
  const tpl = document.getElementById(id);
  if (!tpl) throw new Error(`Template not found: #${id}`);
  const first = tpl.content.firstElementChild;
  if (!first) throw new Error(`Template #${id} has no element content`);
  return first.cloneNode(true);
}
function inScope(root, el) {
  const scope = el.closest("[data-scope]");
  return !scope || scope === root || !root.contains(scope);
}
function refs(root) {
  const map = {};
  const self = root;
  if (self.matches?.("[data-ref]")) map[self.dataset.ref] = self;
  root.querySelectorAll("[data-ref]").forEach((el) => {
    if (inScope(root, el)) map[el.dataset.ref] = el;
  });
  return map;
}
var BIND_ALIAS = {
  text: "textContent",
  // XSS-safe; the right default for untrusted text
  html: "innerHTML",
  //  TRUSTED content only
  class: "className"
  // the DOM property for the `class` attribute
};
function applyBindings(root, data) {
  const targets = [
    ...root.matches?.("[data-bind]") ? [root] : [],
    ...[...root.querySelectorAll("[data-bind]")].filter((el) => inScope(root, el))
  ];
  targets.forEach((el) => {
    el.dataset.bind.split(";").forEach((rule) => {
      const [kind, field] = rule.split(":").map((s) => s.trim());
      if (!kind) return;
      const prop = BIND_ALIAS[kind] ?? kind;
      el[prop] = data[field];
    });
  });
}
function tracker() {
  const cleanups = [];
  return {
    track: (unsub) => {
      cleanups.push(unsub);
      return unsub;
    },
    dispose: () => {
      cleanups.forEach((fn) => fn());
      cleanups.length = 0;
    }
  };
}
function createView(mountFn) {
  const { track, dispose } = tracker();
  const api = mountFn(track) ?? {};
  return {
    ...api,
    destroy() {
      dispose();
      api.el?.remove();
    }
  };
}
function enhance(target, mountFn) {
  const el = typeof target === "string" ? document.querySelector(target) : target;
  if (!el) throw new Error(`enhance: no element matches ${JSON.stringify(target)}`);
  const { track, dispose } = tracker();
  const api = mountFn(el, track) ?? {};
  return {
    ...api,
    el,
    destroy() {
      dispose();
    }
  };
}
function delegate(root, handlers) {
  const seen = /* @__PURE__ */ new Set();
  const collect = (scope) => scope.querySelectorAll("[data-on]").forEach(
    (el) => el.dataset.on.split(";").forEach((r) => seen.add(r.split(":")[0].trim()))
  );
  if (root.matches?.("[data-on]")) {
    root.dataset.on.split(";").forEach((r) => seen.add(r.split(":")[0].trim()));
  }
  collect(root);
  document.querySelectorAll("template").forEach((t) => collect(t.content));
  const unsubs = [];
  seen.forEach((evt) => {
    const listener = (e) => {
      const el = e.target?.closest("[data-on]");
      if (!el || !root.contains(el) || !inScope(root, el)) return;
      el.dataset.on.split(";").forEach((rule) => {
        const [type, action] = rule.split(":").map((s) => s.trim());
        if (type === evt && handlers[action]) handlers[action](e, el);
      });
    };
    root.addEventListener(evt, listener);
    unsubs.push(() => root.removeEventListener(evt, listener));
  });
  return () => unsubs.forEach((u) => u());
}
function mount(track, slot, vf, props) {
  const view = typeof vf === "function" ? vf(props) : vf;
  track(view.destroy);
  if (view.el) slot.appendChild(view.el);
  return view;
}
function adoptTemplates(doc) {
  doc.querySelectorAll("template").forEach((t) => {
    if (t.id && !document.getElementById(t.id)) {
      document.body.appendChild(document.importNode(t, true));
    }
  });
}
function adoptStyles(doc, src) {
  doc.querySelectorAll("style").forEach((s) => {
    const clone = document.importNode(s, true);
    clone.dataset.vanillaSrc = src;
    document.head.appendChild(clone);
  });
}
function resolveAssetUrl(url, base = document.baseURI) {
  const u = new URL(url, base);
  u.username = "";
  u.password = "";
  return u.href;
}
var _templateLoads = /* @__PURE__ */ new Map();
function loadTemplates(url) {
  const abs = resolveAssetUrl(url);
  let p = _templateLoads.get(abs);
  if (!p) {
    p = fetch(abs).then((r) => r.text()).then(
      (html) => adoptTemplates(new DOMParser().parseFromString(html, "text/html"))
    );
    _templateLoads.set(abs, p);
  }
  return p;
}
var _componentLoads = /* @__PURE__ */ new Map();
function loadComponent(url) {
  const abs = resolveAssetUrl(url);
  let p = _componentLoads.get(abs);
  if (!p) {
    p = (async () => {
      const html = await fetch(abs).then((r) => r.text());
      const doc = new DOMParser().parseFromString(html, "text/html");
      adoptTemplates(doc);
      adoptStyles(doc, abs);
      const script = doc.querySelector('script[type="module"]');
      if (!script) return {};
      const blobUrl = URL.createObjectURL(
        new Blob([script.textContent ?? ""], { type: "text/javascript" })
      );
      try {
        return await import(blobUrl);
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    })();
    _componentLoads.set(abs, p);
  }
  return p;
}

// src/mod.ts
var COMPONENTS_BASE = new URL("../components/", import.meta.url).href;
function componentUrl(name, base = COMPONENTS_BASE) {
  return new URL(`${name}.html`, base).href;
}
var BASE_STYLES_ID = "vui-base";
function baseStylesUrl(base = COMPONENTS_BASE) {
  return new URL("base.css", base).href;
}
var _stylesLoad;
function loadStyles(base = COMPONENTS_BASE) {
  if (_stylesLoad) return _stylesLoad;
  if (document.getElementById(BASE_STYLES_ID)) {
    return _stylesLoad = Promise.resolve();
  }
  const url = baseStylesUrl(base);
  _stylesLoad = fetch(url).then((r) => {
    if (!r.ok) {
      throw new Error(
        `vanilla-ui: cannot load base styles (${r.status} ${url}). components/base.css ships with the kit \u2014 copy the whole folder, or pass the right base to loadAll()/loadStyles().`
      );
    }
    return r.text();
  }).then((css) => {
    if (document.getElementById(BASE_STYLES_ID)) return;
    const style = document.createElement("style");
    style.id = BASE_STYLES_ID;
    style.textContent = css;
    document.head.prepend(style);
  });
  return _stylesLoad;
}
function button(label, opts = {}) {
  const el = document.createElement("button");
  el.type = opts.type ?? "button";
  el.textContent = label;
  el.className = [
    "vui-btn",
    opts.variant && opts.variant !== "default" ? `vui-btn--${opts.variant}` : "",
    opts.icon ? "vui-btn--icon" : "",
    opts.class ?? ""
  ].filter(Boolean).join(" ");
  if (opts.value != null) el.value = opts.value;
  if (opts.disabled) el.disabled = true;
  if (opts.ariaLabel) el.setAttribute("aria-label", opts.ariaLabel);
  if (opts.role) el.setAttribute("role", opts.role);
  if (opts.onClick) el.addEventListener("click", opts.onClick);
  return el;
}
async function loadDialog(base = COMPONENTS_BASE) {
  await loadStyles(base);
  const mod = await loadComponent(componentUrl("dialog", base));
  return mod.createDialog;
}
async function loadPopover(base = COMPONENTS_BASE) {
  await loadStyles(base);
  const mod = await loadComponent(componentUrl("popover", base));
  return mod.createPopover;
}
async function loadDisclosure(base = COMPONENTS_BASE) {
  await loadStyles(base);
  const mod = await loadComponent(componentUrl("disclosure", base));
  return mod.createDisclosure;
}
async function loadTabs(base = COMPONENTS_BASE) {
  await loadStyles(base);
  const mod = await loadComponent(componentUrl("tabs", base));
  return mod.createTabs;
}
async function loadToast(base = COMPONENTS_BASE) {
  await loadStyles(base);
  const mod = await loadComponent(componentUrl("toast", base));
  return mod.createToast;
}
async function loadAll(base = COMPONENTS_BASE) {
  await loadStyles(base);
  const [createDialog, createDisclosure, createPopover, createTabs, createToast] = await Promise.all([
    loadDialog(base),
    loadDisclosure(base),
    loadPopover(base),
    loadTabs(base),
    loadToast(base)
  ]);
  return { createDialog, createDisclosure, createPopover, createTabs, createToast };
}
export {
  BASE_STYLES_ID,
  COMPONENTS_BASE,
  MAX_UPDATE_DEPTH,
  applyBindings,
  baseStylesUrl,
  button,
  componentUrl,
  computed,
  createView,
  delegate,
  enhance,
  fromTemplate,
  loadAll,
  loadComponent,
  loadDialog,
  loadDisclosure,
  loadPopover,
  loadStyles,
  loadTabs,
  loadTemplates,
  loadToast,
  mount,
  observable,
  reactTo,
  refs,
  resolveAssetUrl
};
