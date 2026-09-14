/** One temporary history entry for all open panels and the active quiz guard. */
type Layer = { close: () => void };
type Guard = { message: string; fallback: string };
const marker = "__meowNavigation";

export function createNavigationController(win: Window) {
  const layers = new Map<symbol, Layer>();
  const guards = new Map<symbol, Guard>();
  let sentinelUrl: string | null = null;
  let pending: (() => void) | null = null;
  let released = false;
  const currentGuard = () => [...guards.values()].at(-1);
  const hasWork = () => layers.size > 0 || (!released && guards.size > 0);
  const isSentinel = () => sentinelUrl === win.location.href && win.history.state?.[marker];

  function arm() {
    if (!hasWork() || pending || isSentinel()) return;
    sentinelUrl = win.location.href;
    // A reload can retain the existing marker. Reuse it instead of stacking
    // another same-route entry each time a saved quiz is restored.
    if (win.history.state?.[marker]) return;
    win.history.pushState({ ...win.history.state, [marker]: true }, "", sentinelUrl);
  }

  function reconcile() {
    if (pending) return;
    if (hasWork()) arm();
    else if (isSentinel()) {
      pending = () => { if (hasWork()) arm(); };
      win.history.back();
    }
  }

  function closeTop() {
    const entry = [...layers.entries()].at(-1);
    if (!entry) return false;
    layers.delete(entry[0]);
    entry[1].close();
    queueMicrotask(reconcile);
    return true;
  }

  function approve() {
    const guard = currentGuard();
    return released || !guard || win.confirm(guard.message);
  }

  function navigate(action: () => void) {
    if (pending || !approve()) return;
    released = true;
    if (isSentinel()) {
      pending = action;
      win.history.back();
    } else action();
  }

  function onPop(event: PopStateEvent) {
    if (!sentinelUrl || win.location.href !== sentinelUrl) return;
    // Same-document panel history must not become a route navigation.
    event.stopImmediatePropagation();
    if (pending) {
      const action = pending;
      pending = null;
      sentinelUrl = null;
      action();
      return;
    }
    sentinelUrl = null;
    if (closeTop()) {
      arm();
      return;
    }
    if (!approve()) { arm(); return; }
    const fallback = currentGuard()?.fallback;
    released = true;
    if (win.history.length <= 2 && fallback) win.location.replace(fallback);
    else win.history.back();
  }

  function onClick(event: MouseEvent) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target;
    const link = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
    if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
    const url = new URL(link.href, win.location.href);
    if (url.pathname === win.location.pathname && url.search === win.location.search && url.origin === win.location.origin) return;
    if (!hasWork()) return;
    if (pending) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (!approve()) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    // Replay the original link after removing the temporary entry, preserving Next Link behavior.
    event.preventDefault();
    event.stopImmediatePropagation();
    released = true;
    const replay = () => {
      layers.clear();
      link.click();
    };
    if (isSentinel()) { pending = replay; win.history.back(); }
    else replay();
  }

  function onKey(event: KeyboardEvent) {
    if (event.key !== "Escape" || !layers.size) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeTop();
  }

  function onUnload(event: BeforeUnloadEvent) {
    if (released || !guards.size) return;
    event.preventDefault();
    event.returnValue = "";
  }

  win.addEventListener("popstate", onPop, true);
  win.addEventListener("keydown", onKey, true);
  win.addEventListener("beforeunload", onUnload);
  win.document.addEventListener("click", onClick, true);

  return {
    addLayer(close: () => void) {
      const id = Symbol();
      layers.set(id, { close });
      arm();
      return () => { layers.delete(id); queueMicrotask(reconcile); };
    },
    addGuard(message: string, fallback: string) {
      const id = Symbol();
      released = false;
      guards.set(id, { message, fallback });
      arm();
      return () => { guards.delete(id); queueMicrotask(reconcile); };
    },
    back(action: () => void) { if (!closeTop()) navigate(action); },
    navigate,
    dispose() {
      win.removeEventListener("popstate", onPop, true);
      win.removeEventListener("keydown", onKey, true);
      win.removeEventListener("beforeunload", onUnload);
      win.document.removeEventListener("click", onClick, true);
    },
  };
}

let controller: ReturnType<typeof createNavigationController> | undefined;
export const navigationController = () => controller ??= createNavigationController(window);
