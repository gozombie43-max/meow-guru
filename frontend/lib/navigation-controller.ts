/** One temporary history entry for all open panels and the active quiz guard. */
type Layer = { close: () => unknown };
type Guard = { message: string; fallback: string };
export type ExitConfirmation = { message: string; theme: "light" | "dark" };
const marker = "__meowNavigation";
const trailKey = "__meowRouteTrail";

export function createNavigationController(win: Window) {
  // Keep the actual history chain so returning to a parent can traverse directly
  // to its existing entry (including its filters), instead of duplicating it.
  const originalPush = win.history.pushState;
  const originalReplace = win.history.replaceState;
  const currentUrl = () => win.location.pathname + win.location.search + win.location.hash;
  const trail = (): string[] => Array.isArray(win.history.state?.[trailKey])
    ? win.history.state[trailKey] : [currentUrl()];
  const targetUrl = (url?: string | URL | null) => {
    const target = new URL(url == null ? win.location.href : String(url), win.location.href);
    return target.pathname + target.search + target.hash;
  };
  win.history.replaceState = function (state, unused, url) {
    const entries = trail();
    originalReplace.call(this, { ...state, [trailKey]: [...entries.slice(0, -1), targetUrl(url)] }, unused, url);
  };
  win.history.pushState = function (state, unused, url) {
    originalPush.call(this, { ...state, [trailKey]: [...trail(), targetUrl(url)].slice(-100) }, unused, url);
  };
  win.history.replaceState(win.history.state, "", win.location.href);
  const layers = new Map<symbol, Layer>();
  const guards = new Map<symbol, Guard>();
  let sentinelUrl: string | null = null;
  let pending: (() => void) | null = null;
  let returning = false;
  let released = false;
  let confirmation: ExitConfirmation | null = null;
  let confirmedAction: (() => void) | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(listener => listener());

  function resolveConfirmation(leave: boolean) {
    const action = confirmedAction;
    confirmedAction = null;
    confirmation = null;
    emit();
    if (leave) action?.();
  }
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
    if (entry[1].close() !== false) layers.delete(entry[0]);
    queueMicrotask(reconcile);
    return true;
  }

  function requestApproval(action: () => void) {
    const guard = currentGuard();
    if (released || !guard) { action(); return; }
    if (confirmation) return;
    const surface = win.document.querySelector(".ios-series-quiz, .mac-series-quiz, .training-session");
    const theme = surface?.getAttribute("data-theme") || win.document.documentElement.dataset.theme;
    confirmation = { message: guard.message.replace(/^Leave[^?]*\?\s*/, ""), theme: theme === "light" ? "light" : "dark" };
    confirmedAction = action;
    emit();
  }

  function complete(action: () => void) {
    released = true;
    layers.clear();
    if (confirmation) resolveConfirmation(false);
    // Guard cleanup may already be removing its temporary entry. Finish that
    // traversal before changing routes, even when a submit response is immediate.
    if (pending) { pending = action; return; }
    if (isSentinel()) {
      pending = action;
      win.history.back();
    } else action();
  }

  function navigate(action: () => void) {
    if (pending) return;
    requestApproval(() => complete(action));
  }

  function onPop(event: PopStateEvent) {
    returning = false;
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
    if (confirmation) {
      resolveConfirmation(false);
      arm();
      return;
    }
    if (closeTop()) {
      arm();
      return;
    }
    const fallback = currentGuard()?.fallback;
    // Restore the temporary entry while the custom modal awaits a decision.
    // Cancelling (including another Back press) therefore stays in the quiz.
    arm();
    navigate(() => {
      if (win.history.length <= 2 && fallback) win.location.replace(fallback);
      else win.history.back();
    });
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
    // Replay the original link after removing the temporary entry, preserving Next Link behavior.
    event.preventDefault();
    event.stopImmediatePropagation();
    const replay = () => {
      layers.clear();
      link.click();
    };
    navigate(replay);
  }

  function onKey(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    if (confirmation) {
      event.preventDefault();
      event.stopImmediatePropagation();
      resolveConfirmation(false);
      return;
    }
    if (!layers.size) return;
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
    getConfirmation: () => confirmation,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    resolveConfirmation,
    addLayer(close: () => unknown) {
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
      return () => {
        guards.delete(id);
        if (!guards.size && confirmation) resolveConfirmation(false);
        queueMicrotask(reconcile);
      };
    },
    back(action: () => void) {
      if (confirmation) resolveConfirmation(false);
      else if (!closeTop()) navigate(action);
    },
    navigate,
    complete,
    returnTo(parent: string, fallback: () => void) {
      if (returning) return;
      const target = new URL(parent, win.location.href);
      const entries = trail();
      const index = entries.slice(0, -1).findLastIndex(entry => {
        const url = new URL(entry, win.location.href);
        return url.pathname === target.pathname && (!target.search || url.search === target.search);
      });
      if (index >= 0) { returning = true; win.history.go(index - entries.length + 1); }
      else fallback();
    },
    dispose() {
      win.history.pushState = originalPush;
      win.history.replaceState = originalReplace;
      win.removeEventListener("popstate", onPop, true);
      win.removeEventListener("keydown", onKey, true);
      win.removeEventListener("beforeunload", onUnload);
      win.document.removeEventListener("click", onClick, true);
    },
  };
}

let controller: ReturnType<typeof createNavigationController> | undefined;
export const navigationController = () => controller ??= createNavigationController(window);
