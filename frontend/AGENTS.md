<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Web interface guidelines

Follow [Vercel's official Web Interface Guidelines](https://vercel.com/design/guidelines)
when creating, changing, or reviewing interfaces in this frontend. Read the relevant
sections before implementation and review the resulting interface against them.
Use the guidelines as a quality checklist alongside `design.md`, which owns Meow's
design system. Preserve Meow's subtle dark/iOS-style visual direction and explicit
product requirements. The checklist below highlights requirements and does not
replace the complete guide.

### Priorities and flexibility

Prioritize accessibility and interaction correctness, then mobile usability,
performance, readability, consistency, and visual polish, in that order.

- Follow the engineering and UX requirements: keyboard access, visible focus,
  44px mobile targets, semantic controls, labels and live feedback, safe areas,
  responsive layouts, reduced motion, layout stability, deliberate asset loading,
  shareable URL state, and measured performance budgets.
- Treat spacing, radii, shadows, typography hierarchy, animation timing, skeleton
  presentation, hover styling, and card composition as flexible product choices.
  Keep them consistent with the surrounding Meow interface.
- Vercel's wording, ampersands, capitalization, visual taste, and black/white
  minimalism are brand preferences. Adopt them only when they suit Meow; they
  must not dictate its identity or trigger a cosmetic redesign.

### Interactions and accessibility

- Use native semantic controls and real links for navigation. Support keyboard
  operation, visible `:focus-visible` styles, correct dialog focus handling, and
  focus restoration. Fixed surfaces must not obscure focused controls.
- Give every control an accessible name. Label icon buttons, hide decorative
  artwork from assistive technology, maintain heading order, and provide a skip link.
- Make hit targets at least 24px and at least 44px on mobile, even when the visible
  icon is smaller. Provide click and keyboard alternatives to gestures.
- Keep browser zoom enabled. Use input text of at least 16px on mobile rather than
  restricting zoom. Preserve input values and focus through hydration.
- Allow paste, autofill, password managers, and one-time-code completion. Announce
  asynchronous feedback with appropriate live regions and use more than color to
  convey status. Provide accessible media alternatives and controls.
- Make shareable filters, tabs, and pagination work with URLs, refresh, and browser
  history. Preserve expected scroll restoration; keep private input out of URLs.
- Require confirmation or offer undo for destructive UI actions. Reconcile
  optimistic updates with clear recovery when a request fails.

### Forms and loading

- Associate labels with controls and use meaningful names, autocomplete tokens,
  input types, and input modes. Ensure labels activate their controls.
- Keep submission available until a request starts. Validate on submission, show
  field-level errors, and focus the first invalid field. Avoid blocking keystrokes.
- Support normal form submission and multiline text entry; use Cmd/Ctrl+Enter for
  textarea submission where applicable. Warn before losing unsaved edits.
- During submission, prevent duplicate requests, retain the button label, and show
  progress. Use server-supported idempotency for operations that need it.
- Keep loading feedback stable: delay transient indicators when appropriate,
  avoid flicker, and reserve the final content's space. Verify loading timing
  explicitly rather than assuming Suspense supplies a particular duration.
- Design loading, empty, error, sparse, and dense states with useful next steps.
  Use explicit foreground and background colors for native selects in both themes.

### Layout, motion, and visual design

- Use CSS flex, grid, and intrinsic sizing. Handle long text, safe-area insets,
  fixed actions, and narrow screens without unintended overflow.
- Verify changed layouts on mobile, laptop, and wide screens, in supported themes.
  Align elements deliberately and keep typography, spacing, borders, shadows,
  nested corner radii, and icon weight consistent with neighboring surfaces.
- Maintain readable contrast and distinguish hover, active, and focus states.
  Match browser `theme-color` and `color-scheme` to the active theme.
- Honor `prefers-reduced-motion`. Prefer CSS and animate explicit properties,
  usually `transform` and `opacity`; avoid `transition: all` and layout thrashing.
- Keep animations purposeful and interruptible. Provide pause, stop, or hide
  controls for automatically moving content when required, plus still fallbacks.
  Use intentional scroll containment in overlays without breaking mobile scrolling.
- Home's carousel uses three navigation dots without a dedicated Pause/Resume
  action, per product direction. Preserve its reduced-motion and interaction safeguards.

### Content and performance

- Write concise, specific action labels and recovery-oriented errors. Keep terms
  consistent, use the ellipsis character for pending actions, and format dates,
  numbers, and currencies for the user's locale. Keep units with their values.
- Provide accurate page titles, inline help, accessible status text, and tabular
  numerals where values are compared. Protect verbatim technical identifiers from
  automatic translation and use language preferences for language selection.
- Reserve image dimensions, prioritize above-the-fold assets, lazy-load remaining
  media, and load fonts deliberately to minimize layout shifts and network work.
- Keep typing and rendering responsive. Measure rerenders, virtualize large lists
  when needed, batch layout reads and writes, and move expensive work off the main
  thread. Measure mutation latency against the guide's 500ms target.

### Review and verification

- Review every generated or changed interface against the complete guide before
  reporting it finished. Use Meow's existing terminology and the user's explicit
  wording requirements when assessing optional Vercel copy preferences.
- Run checks appropriate to the changed behavior and inspect the rendered result
  when visual layout or interaction changes. Include keyboard, focus, responsive,
  theme, and reduced-motion checks when relevant.
- Report exactly what was verified. Distinguish local checks from browser, Safari,
  physical-device, throttled-performance, and production evidence; name any
  relevant verification that was unavailable.
