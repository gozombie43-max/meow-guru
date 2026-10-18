"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.navigationController = void 0;
exports.createNavigationController = createNavigationController;
const marker = "__meowNavigation";
function createNavigationController(win) {
    const layers = new Map();
    const guards = new Map();
    let sentinelUrl = null;
    let pending = null;
    let released = false;
    let confirmation = null;
    let confirmedAction = null;
    const listeners = new Set();
    const emit = () => listeners.forEach(listener => listener());
    function resolveConfirmation(leave) {
        const action = confirmedAction;
        confirmedAction = null;
        confirmation = null;
        emit();
        if (leave)
            action?.();
    }
    const currentGuard = () => [...guards.values()].at(-1);
    const hasWork = () => layers.size > 0 || (!released && guards.size > 0);
    const isSentinel = () => sentinelUrl === win.location.href && win.history.state?.[marker];
    function arm() {
        if (!hasWork() || pending || isSentinel())
            return;
        sentinelUrl = win.location.href;
        // A reload can retain the existing marker. Reuse it instead of stacking
        // another same-route entry each time a saved quiz is restored.
        if (win.history.state?.[marker])
            return;
        win.history.pushState({ ...win.history.state, [marker]: true }, "", sentinelUrl);
    }
    function reconcile() {
        if (pending)
            return;
        if (hasWork())
            arm();
        else if (isSentinel()) {
            pending = () => { if (hasWork())
                arm(); };
            win.history.back();
        }
    }
    function closeTop() {
        const entry = [...layers.entries()].at(-1);
        if (!entry)
            return false;
        if (entry[1].close() !== false)
            layers.delete(entry[0]);
        queueMicrotask(reconcile);
        return true;
    }
    function requestApproval(action) {
        const guard = currentGuard();
        if (released || !guard) {
            action();
            return;
        }
        if (confirmation)
            return;
        const surface = win.document.querySelector(".ios-series-quiz, .mac-series-quiz, .training-session");
        const theme = surface?.getAttribute("data-theme") || win.document.documentElement.dataset.theme;
        confirmation = { message: guard.message.replace(/^Leave[^?]*\?\s*/, ""), theme: theme === "light" ? "light" : "dark" };
        confirmedAction = action;
        emit();
    }
    function navigate(action) {
        if (pending)
            return;
        requestApproval(() => {
            released = true;
            if (isSentinel()) {
                pending = action;
                win.history.back();
            }
            else
                action();
        });
    }
    function onPop(event) {
        if (!sentinelUrl || win.location.href !== sentinelUrl)
            return;
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
            if (win.history.length <= 2 && fallback)
                win.location.replace(fallback);
            else
                win.history.back();
        });
    }
    function onClick(event) {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
            return;
        const target = event.target;
        const link = target instanceof Element ? target.closest("a[href]") : null;
        if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self"))
            return;
        const url = new URL(link.href, win.location.href);
        if (url.pathname === win.location.pathname && url.search === win.location.search && url.origin === win.location.origin)
            return;
        if (!hasWork())
            return;
        if (pending) {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }
        // Replay the original link after removing the temporary entry, preserving Next Link behavior.
        event.preventDefault();
        event.stopImmediatePropagation();
        const replay = () => {
            layers.clear();
            link.click();
        };
        navigate(replay);
    }
    function onKey(event) {
        if (event.key !== "Escape")
            return;
        if (confirmation) {
            event.preventDefault();
            event.stopImmediatePropagation();
            resolveConfirmation(false);
            return;
        }
        if (!layers.size)
            return;
        event.preventDefault();
        event.stopImmediatePropagation();
        closeTop();
    }
    function onUnload(event) {
        if (released || !guards.size)
            return;
        event.preventDefault();
        event.returnValue = "";
    }
    win.addEventListener("popstate", onPop, true);
    win.addEventListener("keydown", onKey, true);
    win.addEventListener("beforeunload", onUnload);
    win.document.addEventListener("click", onClick, true);
    return {
        getConfirmation: () => confirmation,
        subscribe(listener) {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
        resolveConfirmation,
        addLayer(close) {
            const id = Symbol();
            layers.set(id, { close });
            arm();
            return () => { layers.delete(id); queueMicrotask(reconcile); };
        },
        addGuard(message, fallback) {
            const id = Symbol();
            released = false;
            guards.set(id, { message, fallback });
            arm();
            return () => {
                guards.delete(id);
                if (!guards.size && confirmation)
                    resolveConfirmation(false);
                queueMicrotask(reconcile);
            };
        },
        back(action) {
            if (confirmation)
                resolveConfirmation(false);
            else if (!closeTop())
                navigate(action);
        },
        navigate,
        dispose() {
            win.removeEventListener("popstate", onPop, true);
            win.removeEventListener("keydown", onKey, true);
            win.removeEventListener("beforeunload", onUnload);
            win.document.removeEventListener("click", onClick, true);
        },
    };
}
let controller;
const navigationController = () => controller ??= createNavigationController(window);
exports.navigationController = navigationController;
