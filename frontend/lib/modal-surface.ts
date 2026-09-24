type Surface = { element: HTMLElement; previousFocus: HTMLElement | null };
const stack: Surface[] = [];
const inertState = new Map<HTMLElement, boolean>();
let previousOverflow = "";

function restoreBackground() {
  inertState.forEach((inert, element) => { element.inert = inert; });
  inertState.clear();
}

function syncBackground() {
  restoreBackground();
  let branch: HTMLElement | null = stack.at(-1)?.element ?? null;
  while (branch && branch !== document.body) {
    for (const sibling of branch.parentElement?.children ?? []) {
      if (!(sibling instanceof HTMLElement) || sibling === branch || sibling.hasAttribute("data-dialog-backdrop")) continue;
      inertState.set(sibling, sibling.inert);
      sibling.inert = true;
    }
    branch = branch.parentElement;
  }
}

function controls(element: HTMLElement) {
  return [...element.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, summary, [tabindex]')]
    .filter(node => node.tabIndex >= 0 && !node.matches(':disabled') && !node.closest('[hidden], [inert]') && getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden');
}

/** Shared lifecycle for styled overlays and native dialogs; only the top layer owns focus. */
export function activateModalSurface(element: HTMLElement, initialFocus?: string, previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null) {
  const surface: Surface = { element, previousFocus };
  if (!stack.length) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  stack.push(surface);
  syncBackground();
  const focusInside = () => {
    const preferred = initialFocus === ":scope" ? element : initialFocus ? element.querySelector<HTMLElement>(initialFocus) : null;
    (preferred ?? controls(element)[0] ?? element).focus({ preventScroll: true });
  };
  focusInside();
  const onFocus = (event: FocusEvent) => {
    if (stack.at(-1) === surface && event.target instanceof Node && !element.contains(event.target)) focusInside();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "Tab" || stack.at(-1) !== surface) return;
    const items = controls(element);
    const first = items[0];
    const last = items.at(-1);
    if (!first) { event.preventDefault(); element.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === element)) {
      event.preventDefault(); first.focus();
    }
  };
  document.addEventListener("focusin", onFocus);
  document.addEventListener("keydown", onKey);
  const observer = new MutationObserver(syncBackground);
  observer.observe(document.body, { childList: true, subtree: true });
  let released = false;
  return () => {
    if (released) return;
    released = true;
    observer.disconnect();
    document.removeEventListener("focusin", onFocus);
    document.removeEventListener("keydown", onKey);
    const wasTop = stack.at(-1) === surface;
    stack.splice(stack.indexOf(surface), 1);
    syncBackground();
    if (!stack.length) document.body.style.overflow = previousOverflow;
    if (wasTop && surface.previousFocus?.isConnected && !surface.previousFocus.closest('[inert]')) surface.previousFocus.focus({ preventScroll: true });
  };
}
