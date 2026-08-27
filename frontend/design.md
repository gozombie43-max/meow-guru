# Meow Guru — Frontend Layout & Mobile Shell Design System (`design.md`)

This document defines the mandatory layout architecture and CSS design rules for all pages in **Meow Guru**. Every page must follow these rules to ensure flawless rendering across **Android WebView (APK)**, **iOS Safari (PWA)**, **Mobile Browsers**, and **Desktop macOS/Windows**.

---

## 1. Single Source of Truth: Global CSS Variables

All layout dimensions and safe-area insets are centralized in `frontend/app/globals.css` on `:root`:

```css
:root {
  /* Safe Area Insets (iOS Notch, Dynamic Island, Android cutouts & gesture bar) */
  --safe-area-inset-top: env(safe-area-inset-top, 0px);
  --safe-area-inset-right: env(safe-area-inset-right, 0px);
  --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-inset-left: env(safe-area-inset-left, 0px);

  /* Shorthand aliases — always use these */
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);

  /* App Shell Fixed Dimensions */
  --app-header-height: 56px;
  --app-bottom-nav-height: 94px;
}
```

---

## 2. The 4 Fundamental Layout Rules

### Rule 1: Header Safe-Area & Dynamic Height Sync
- **Sticky / In-Flow Headers**: Must include `padding-top: var(--safe-top);` or `padding: calc(12px + var(--safe-top)) 16px 12px;` so the back button and title never collide with the OS status bar or camera hole punch.
- **Fixed Headers**: When `position: fixed; top: 0;` is used, the header must have `padding-top: var(--safe-top);` and the main page container must have `padding-top: calc(var(--app-header-height) + var(--safe-top));`.

### Rule 2: Natural Document Flow on Mobile (No Flex-Centering Hacks)
- Root wrappers (`.page`, `.pageWrapper`, `.container`) on mobile breakpoints (`< 1024px` or `< 768px`) must use `display: block; width: 100%; min-height: 100dvh;`.
- **Never** put `display: flex; align-items: center; justify-content: center; min-height: 100vh;` on the root page wrapper of scrollable pages on mobile, as this causes content jumping and double-margin issues.

### Rule 3: Always Use `100dvh` / `min-h-dvh` (Never `100vh` or `min-h-screen`)
- `100vh` measures the screen without accounting for dynamic browser/WebView chrome and gesture navigation bars.
- Use `100dvh` in CSS and `min-h-dvh` / `h-dvh` in Tailwind classes.

### Rule 4: Clean Bottom Navigation & Floating Bar Clearance
- On routes where `BottomNav` is visible (Home, Subject Hubs, Play, Videos, Notes), `body.has-bottom-nav` automatically provides:
  ```css
  padding-bottom: calc(var(--app-bottom-nav-height) + var(--safe-bottom));
  ```
- Page containers should only add their own small internal breathing room (`padding-bottom: 24px;`).
- Fixed bottom action bars (e.g. Test Engine, Chat Composer) must include `padding-bottom: calc(16px + var(--safe-bottom));`.

---

## 3. Standard Code Templates

### A. Standard Scrollable Page (e.g. Subject Topic / Hub / List)

```tsx
export default function StandardPage() {
  return (
    <div className="page-root">
      <header className="page-header">
        <button className="back-btn" onClick={() => router.back()}>
          <ChevronLeft />
        </button>
        <h1 className="page-title">Topic Title</h1>
      </header>

      <main className="page-content">
        {/* Content Cards */}
      </main>

      <style jsx>{`
        .page-root {
          min-height: calc(100dvh - var(--app-bottom-nav-height) - var(--safe-bottom));
          width: 100%;
          box-sizing: border-box;
          background: var(--bg);
          padding-bottom: 24px;
        }

        .page-header {
          position: sticky;
          top: 0;
          z-index: 40;
          height: calc(56px + var(--safe-top));
          padding: var(--safe-top) 16px 0;
          display: flex;
          align-items: center;
          background: var(--header-bg);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border);
        }

        .page-content {
          padding: 16px;
          max-width: 720px;
          margin: 0 auto;
        }
      `}</style>
    </div>
  );
}
```

---

### B. Fullscreen Interactive View (Quiz Engine / AI Chat / Mock Test)

```tsx
export default function InteractiveAppShell() {
  return (
    <div className="app-shell">
      <header className="app-topbar">
        {/* Top controls */}
      </header>

      <main className="app-scroll-body">
        {/* Scrollable question or messages */}
      </main>

      <footer className="app-bottom-bar">
        {/* Fixed bottom controls */}
      </footer>

      <style jsx>{`
        .app-shell {
          height: 100dvh;
          width: 100vw;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--bg);
        }

        .app-topbar {
          flex-shrink: 0;
          padding: calc(8px + var(--safe-top)) 16px 8px;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          z-index: 20;
        }

        .app-scroll-body {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding: 16px;
          padding-bottom: calc(80px + var(--safe-bottom));
        }

        .app-bottom-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 12px 16px calc(12px + var(--safe-bottom));
          background: var(--surface);
          border-top: 1px solid var(--border);
          z-index: 30;
        }
      `}</style>
    </div>
  );
}
```

---

## 4. Anti-Patterns & Code Review Checklist

| ❌ NEVER DO THIS | ✅ ALWAYS DO THIS INSTEAD |
|---|---|
| `height: 100vh;` or `min-height: 100vh;` | `height: 100dvh;` or `min-height: 100dvh;` |
| `className="min-h-screen"` | `className="min-h-dvh"` |
| `padding-top: 16px;` on a sticky/fixed mobile topbar | `padding-top: calc(16px + var(--safe-top));` or `padding: var(--safe-top) 16px 0;` |
| Nested wrappers with duplicate padding (`18px + 16px = 34px`) | Standard clean 16px content margin on a single container level |
| `display: flex; align-items: center; min-height: 100vh;` on scrollable page root | `display: block; min-height: 100dvh;` with natural vertical flow |
| Hardcoded bottom offsets (e.g. `padding-bottom: 120px;`) | `calc(var(--app-bottom-nav-height) + var(--safe-bottom))` |
