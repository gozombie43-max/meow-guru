# Phase 1 — Design Tokens & Theme Architecture (`tokens.md`)

---

## 1. Colour System (Canonical Dark & Light Palettes)

All UI surfaces, text, borders, and controls MUST reference semantic CSS custom properties (`--meow-*`) backed by Tailwind v4 `@theme` utilities. Never hardcode raw hex colours outside token definitions or exempted visualization layers (Section 1.4).

### 1.1 Core Brand & Neutral Tokens

| Semantic Role | CSS Variable | Dark Value (Canonical Default) | Light Value | Dark Contrast (on bg / surface) | Light Contrast (on bg / surface) | Usage Rule |
|---|---|---|---|---|---|---|
| Background | `--meow-bg` | `#080C11` | `#F4F6F9` | — | — | Primary app canvas; `<body>` background |
| Surface | `--meow-surface` | `#111722` | `#FFFFFF` | — | — | Cards, panels, sheets, drawers, headers |
| Surface Subtle / Hover | `--meow-surface-subtle` | `#192231` | `#EBF0F5` | — | — | Muted inputs, hover states, nested chips, active rows |
| Border | `--meow-border` | `#222A38` | `#DCE3EC` | — | — | Default `1px` card, divider, and input hairline |
| Border Strong | `--meow-border-strong` | `#334155` | `#CBD5E1` | — | — | Focused fields, active outlines, high-contrast dividers |
| Text Primary | `--meow-text` | `#F1F4F8` | `#111827` | `17.77` / `16.28` | `16.39` / `17.74` | Headings, body copy, question stems, primary labels |
| Text Secondary | `--meow-secondary` | `#929CAF` | `#4B5565` | `7.09` / `6.50` | `6.96` / `7.54` | Important labels, subtitles, placeholder text, helper text, and ordinary metadata (WCAG AA `>= 4.5:1` on all dark & light surfaces) |
| Text Muted | `--meow-muted` | `#687386` | `#5D6778` | `4.09` / `3.75` | `5.28` / `5.71` | **Strictly restricted in dark mode to disabled UI controls and decorative / non-text elements** (below 4.5:1 for readable text) |
| Accent Primary | `--meow-accent` | `#3B82F6` | `#2563EB` | `5.33` / `4.88` | `4.77` / `5.17` | Highlights, icons, focus indicators, selected outlines, visual accents |
| Accent Light / Text | `--meow-accent-light` | `#60A5FA` | `#1D4ED8` | `7.71` / `7.06` | `6.19` / `6.70` | Inline links, text accents, icon highlights on dark surfaces |
| Accent Soft Surface | `--meow-accent-soft` | `#13243F` *(approx. `16%` tint)* | `#EFF6FF` | — | — | Selected chips, active nav pills, subtle active banners |
| Primary CTA Fill | `--meow-action-fill` | `#2563EB` *(hover `#1D4ED8`)* | `#2563EB` *(hover `#1D4ED8`)* | — | — | Filled primary CTA button background (`5.17:1` with `#FFFFFF` label) |
| Contrast On Accent | `--meow-on-accent` | `#FFFFFF` | `#FFFFFF` | `5.17` on `#2563EB` | `5.17` on `#2563EB` | Labels/icons inside filled primary CTA buttons |

> **Accessibility & Contrast Rules (WCAG AA Verified):**
> 1. **Muted Text (`#687386` in Dark Mode)** measures `4.09:1` on `#080C11`, `3.75:1` on `#111722`, and `3.34:1` on `#192231` (below `4.5:1`). Therefore, `--meow-secondary` (`#929CAF`, `5.78:1`–`7.09:1`) MUST be used for important labels, placeholder text, helper copy, and ordinary metadata. `#687386` is strictly reserved for disabled UI controls and decorative/non-text elements.
> 2. **Primary Button Ink vs. Visual Accent**: `#FFFFFF` on `--meow-accent` (`#3B82F6`) measures `3.68:1`. Therefore, `--meow-action-fill: #2563EB` (`5.17:1` with `#FFFFFF`, hover `#1D4ED8`) is separated for filled primary CTA backgrounds, while `--meow-accent: #3B82F6` remains the general visual accent, focus indicator, icon highlight, and active outline token.

### 1.2 Semantic Status Tokens

Designed to satisfy WCAG `>= 4.5:1` between semantic foreground and its tinted container (`check-light-theme.mjs` contract):

| State | Token Prefix | Dark Ink | Dark Soft Surface | Dark Ratio | Light Ink | Light Soft Surface | Light Ratio |
|---|---|---|---|---:|---|---|---:|
| Success | `--meow-success` / `--meow-success-soft` | `#34D399` | `#0E2923` | `8.03` | `#15803D` | `#ECFDF3` | `4.76` |
| Warning | `--meow-warning` / `--meow-warning-soft` | `#FBBF24` | `#2C220D` | `9.38` | `#92400E` | `#FEF3C7` | `6.37` |
| Error / Danger | `--meow-error` / `--meow-error-soft` | `#F87171` | `#31151B` | `6.06` | `#B91C1C` | `#FEE2E2` | `5.30` |
| Info | `--meow-info` / `--meow-info-soft` | `#60A5FA` | `#13243F` | `6.11` | `#1D4ED8` | `#EFF6FF` | `6.16` |
| Danger Action Fill | `--meow-danger-fill` | `#DC2626` | — | — | `#DC2626` | — | — |

### 1.3 Scrims & Removed Surfaces (Glassmorphism Sunset)

- `--meow-scrim`: `rgba(4, 7, 11, 0.72)` (dark) / `rgba(15, 23, 42, 0.45)` (light) for modal backdrops (`Dialog.tsx`, `BottomSheet`).
- **Deprecated / Banned for new code**: `.bg-blob-1..3`, `.glass*`, `.liquid-btn*`, `--liquid-cyan`, multi-stop gradient CTAs, and `backdrop-filter: blur(...)` on regular cards/headers/lists. *(Modal backdrop blur or bottom dock translucency, if retained for legibility, requires explicit `border: 1px solid var(--meow-border)` and opaque fallback).*

### 1.4 Colour Exemptions (Do NOT Normalize)

Preserve existing domain palettes in:
- `components/geometry/GeometryRenderer.tsx` & diagram SVG helpers (`/api/diagram`)
- `components/QuizChartArt.tsx`, Recharts/analytics chart series, and KaTeX syntax colors
- Subject badge identity hues where distinct subject differentiation is functional (normalized to semantic wrappers only if readability fails)
- `MockTestEngine` / `QuestionPalette` question-status legend (`answered`, `not-answered`, `marked-for-review`, `answered-and-marked`), whose domain status meanings must remain distinct and colorblind-accessible.

---

## 2. Tailwind CSS v4 `@theme` & Variable Layering

Phase 2 replaces competing `:root` theme constants with **one `@theme` declaration** in `frontend/design-system/tokens/theme.css` (imported cleanly from `app/globals.css`), exposing Tailwind utility classes (`bg-meow-bg`, `bg-meow-surface`, `border-meow-border`, `text-meow-text`, `text-meow-secondary`, `text-meow-muted`, `text-meow-accent`, `text-meow-accent-light`, etc.):

```css
@import "tailwindcss";

@theme inline {
  --color-meow-bg: var(--meow-bg);
  --color-meow-surface: var(--meow-surface);
  --color-meow-surface-subtle: var(--meow-surface-subtle);
  --color-meow-border: var(--meow-border);
  --color-meow-border-strong: var(--meow-border-strong);
  --color-meow-text: var(--meow-text);
  --color-meow-secondary: var(--meow-secondary);
  --color-meow-muted: var(--meow-muted);
  --color-meow-accent: var(--meow-accent);
  --color-meow-accent-light: var(--meow-accent-light);
  --color-meow-accent-soft: var(--meow-accent-soft);
  --color-meow-action-fill: var(--meow-action-fill);
  --color-meow-action-fill-hover: var(--meow-action-fill-hover);
  --color-meow-on-accent: var(--meow-on-accent);
  --color-meow-success: var(--meow-success);
  --color-meow-warning: var(--meow-warning);
  --color-meow-error: var(--meow-error);
  --color-meow-info: var(--meow-info);
}
```

### Theme Switching & Nested Preview Isolation Contract
- Default runtime palette on `:root` and `html.theme-dark` / `body.theme-dark` / `[data-theme="dark"]` resolves all `--meow-*` tokens to the **Canonical Dark Palette**.
- `html.theme-light` / `body.theme-light` / `[data-theme="light"]` swaps the **exact same `--meow-*` custom properties** to Light Mode values and sets `color-scheme: light`.
- **Nested isolation preserved**: Any subtree explicitly tagged `[data-theme="dark"]` or `.training-dark` inside a light page MUST override all `--meow-*` variables back to dark values and reset `--light-only-*` bridge tokens (`check-light-theme.mjs` contract).

---

## 3. Typography Scale

Eliminates all 30 ad-hoc `font-family` declarations and sub-pixel sizes (`9.5px`, `10.5px`, `11.5px`, `12.5px`, `13.5px`, `14.5px`).

### 3.1 Font Families
| Token | Stack | Usage |
|---|---|---|
| `--meow-font-sans` | `var(--font-geist-sans), "Noto Sans Bengali", system-ui, -apple-system, sans-serif` | Default app & UI typography |
| `--meow-font-display` | `var(--meow-font-sans)` (`font-feature-settings: "cv02", "cv03", "cv04", "cv11"`) | Hero & section headings (`>= 20px`) |
| `--meow-font-bengali` | `"Noto Sans Bengali", "Hind Siliguri", var(--meow-font-sans)` | Bilingual/Bengali question stems & options |
| `--meow-font-mono` | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` | Exam timers, counters, scores, tabular numbers (`font-variant-numeric: tabular-nums`) |

### 3.2 Discrete Type Ramp
| Role | Token | Size | Line Height | Weight | Replaces (Legacy Sprawl) |
|---|---|---:|---:|---:|---|
| Micro Badge / Tag | `--meow-text-2xs` | `11px` | `16px` (`1.45`) | `500` / `600` | `9px`, `9.5px`, `10px`, `10.5px`, `11px` |
| Meta / Caption | `--meow-text-xs` | `12px` | `16px` (`1.33`) | `400` / `500` | `11.5px`, `12px`, `--ui-font-meta` |
| Secondary UI | `--meow-text-sm` | `13px` | `18px` (`1.38`) | `400` / `500` | `12.5px`, `13px`, `--ui-font-secondary` |
| Body / Control | `--meow-text-base` | `14px` | `20px` (`1.43`) | `400` / `500` / `600` | `13.5px`, `14px`, `14.5px`, `--ui-font-body` |
| Question / Reading | `--meow-text-md` | `16px` | `24px` (`1.50`) | `400` / `500` / `600` | `15px`, `16px` (also mobile input floor `>= 16px`!) |
| Card Title / Subheading | `--meow-text-lg` | `18px` | `24px` (`1.33`) | `600` | `17px`, `18px`, `19px` |
| Page Title | `--meow-text-xl` | `20px` | `28px` (`1.40`) | `700` | `20px`, `21px`, `--ui-font-title` |
| Section Display | `--meow-text-2xl` | `24px` | `32px` (`1.33`) | `700` | `22px`, `23px`, `24px`, `26px` |
| Hero / Metric | `--meow-text-3xl` | `30px` | `36px` (`1.20`) | `700` | `28px`, `30px`+ |

---

## 4. Spacing, Radii, Sizing & Elevation

### 4.1 `4px`-Base Spacing Scale
| Token | Value | Semantic Alias |
|---|---:|---|
| `--meow-space-1` | `4px` | `--ui-space-1` |
| `--meow-space-2` | `8px` | `--ui-space-2` |
| `--meow-space-3` | `12px` | `--ui-space-3` |
| `--meow-space-4` | `16px` | `--ui-space-4`, `--meow-gutter-mobile` |
| `--meow-space-5` | `20px` | Intermediate card padding |
| `--meow-space-6` | `24px` | `--ui-space-6`, `--meow-gutter-desktop`, section gap |
| `--meow-space-8` | `32px` | `--ui-space-8` |
| `--meow-space-10` | `40px` | Page section rhythm |
| `--meow-space-12` | `48px` | Major vertical separation |

### 4.2 Border Radius Scale
Consolidates 20+ arbitrary values (`2px`–`26px`) into **5 discrete tokens**:
| Token | Value | Usage |
|---|---:|---|
| `--meow-radius-xs` | `6px` | Compact tags, inline code, keycaps |
| `--meow-radius-sm` | `8px` | `--ui-radius-sm`, dense admin cells, subtle inner boxes |
| `--meow-radius-md` | `12px` | `--ui-control-radius`, buttons, inputs, option buttons, small cards |
| `--meow-radius-lg` | `16px` | `--ui-radius-lg`, primary cards, panels, dialogs (`--radius-card` standardized down from `24px`) |
| `--meow-radius-xl` | `20px` | Large bottom sheets (top corners) & hero feature banners |
| `--meow-radius-full` | `9999px` | Pills, badges, switches, circular avatars |

### 4.3 Component Heights & Icon Dimensions
| Role | Token | Value | Notes |
|---|---|---:|---|
| Control Default (Touch Safe) | `--meow-control-h-md` | `44px` | Mandatory minimum on mobile & primary buttons (`--ui-control-height`) |
| Control Small (Desktop Dense Only) | `--meow-control-h-sm` | `36px` | Permitted only inside `@media (min-width: 768px) and (pointer: fine)` admin tables/toolbars; expands to `44px` on touch/mobile |
| Control Large (CTA / Quiz Option) | `--meow-control-h-lg` | `48px` | Primary auth submit, quiz option minimum height |
| Header Height | `--meow-header-h` | `56px` | Matches `--app-header-height: 56px` + `var(--safe-top, 0px)` |
| Bottom Dock Clearance | `--meow-bottom-nav-h` | `84px` | Bottom navigation bar height + `var(--safe-bottom, 0px)` (`94px` legacy ceiling maintained during transition) |
| Icon Small / Inline | `--meow-icon-sm` | `16px` | Inline button/badge icons |
| Icon Default | `--meow-icon-md` | `20px` | `--ui-icon-size`, standard header/nav icons |
| Icon Feature / Empty State | `--meow-icon-lg` | `24px` | Section icons, empty-state containers (`48px` container with `24px` glyph) |

### 4.4 Shadows & Borders
- **Default dark UI (`--meow-shadow-none: none`)**: Elevation comes from `#080C11` (bg) → `#111722` (surface) → `#192231` (subtle) + `1px solid var(--meow-border)`.
- **Overlay shadow (`--meow-shadow-overlay`)**: `0 12px 32px rgba(0, 0, 0, 0.55)` (dark) / `0 8px 24px rgba(15, 23, 42, 0.12)` (light) — used **only** on popovers, dialogs, dropdown menus, and toasts.

---

## 5. Motion, Z-Index & Breakpoints

### 5.1 Motion Scale
- `--meow-duration-fast`: `120ms` (press/hover/switch toggle)
- `--meow-duration-base`: `180ms` (dialogs, fade transitions, tabs)
- `--meow-duration-slow`: `260ms` (bottom sheets, drawers)
- `--meow-ease-standard`: `cubic-bezier(0.2, 0, 0, 1)`
- `--meow-ease-exit`: `cubic-bezier(0.4, 0, 1, 1)`
- **Reduced Motion**: Global `@media (prefers-reduced-motion: reduce)` rule in `motion.css` collapses durations to `0.01ms` and disables keyframe transforms once, replacing 45 duplicate per-file rules.

### 5.2 Z-Index Hierarchy
- `--meow-z-base: 0`
- `--meow-z-sticky: 20` (sticky page headers/toolbars)
- `--meow-z-nav: 40` (BottomNav & Desktop rail)
- `--meow-z-popover: 60` (dropdowns, tooltips, SelectionPopover)
- `--meow-z-modal: 80` (Dialog / BottomSheet / QuizChatbot)
- `--meow-z-toast: 100` (FeedbackToast)
- `2147483647` reserved strictly for `.skip-to-content` accessibility bypass.

### 5.3 Unified Responsive Breakpoints
Replaces all 25+ conflicting breakpoints (`340px`, `359px`, `599px`, `767px`, `768px`, `900px`, `1023px`, `1024px`, `1025px`):

| Name | Width Range | Layout Role | Fixed Chrome |
|---|---|---|---|
| `xs` (Narrow phone) | `<= 374px` | `360×800` Safe compactness tweaks (tighten horizontal gaps `16px`→`12px`) | BottomNav dock |
| `mobile` (Default) | `0 – 767px` (`< 48rem`) | Mobile-first single-column base (`360×800`, `393×852`, `430×932`) | Top header (`56px`) + BottomNav (`<= 1023px`) |
| `tablet` | `768px – 1023px` | 2-column grids, expanded card padding (`768×1024`) | BottomNav still shown (replaces off-by-1 `1024`/`1025` bug!) |
| `desktop` | `>= 1024px` (`64rem+`) | Desktop shell, left rail / top bar, 2–3 column layouts (`1366×900`, `1440×900`) | Desktop rail/nav; BottomNav hidden at **`min-width: 1024px`** consistently |

---

## 6. Progressive Legacy Token Bridge (`legacy-bridge.css`)

To uphold the **no unintended visual regression** safeguard during `P0-A`, `legacy-bridge.css` does **not** overwrite existing `--dark-*`, `--oled-*`, `--light-*`, `--ui-*`, or `--color-*` declarations globally on `:root`. Instead:
- Legacy consumers continue resolving their existing stylesheets identically until each module/page migrates.
- Adding the opt-in **`[data-meow-tokens]`** attribute on a migrated component or route subtree rebinds legacy variable namespaces onto canonical `--meow-*` tokens inside that scope cleanly:

| Legacy Token Namespace | Legacy Token(s) | Progressive Scoped Target (`[data-meow-tokens]`) | Sunset Phase |
|---|---|---|---|
| `dark-theme.css` | `--dark-canvas`, `--oled-canvas` | `var(--meow-bg)` | P1–P5 |
| `dark-theme.css` | `--dark-surface`, `--oled-surface`, `--oled-hover`, `--dark-surface-muted`, `--oled-inset` | `var(--meow-surface)` / `var(--meow-surface-subtle)` | P1–P5 |
| `dark-theme.css` | `--dark-text`, `--oled-text`, `--dark-text-secondary`, `--oled-secondary`, `--dark-text-muted` | `var(--meow-text)`, `var(--meow-secondary)` *(readable metadata uses `#929CAF`, not `#687386`)* | P1–P5 |
| `dark-theme.css` | `--dark-accent`, `--oled-selected` / `--dark-action` | `var(--meow-accent)` (`#3B82F6`) / `var(--meow-action-fill)` (`#2563EB`) | P0–P5 |
| `light-theme.css` | `--light-canvas`, `--light-surface`, `--light-surface-muted`, `--light-border`, `--light-text*`, `--light-accent`, `--light-success*`, `--light-danger*`, `--light-warning*`, `--light-only-*` | Light `--meow-*` tokens (with nested dark isolation preserved) | P0–P5 |
| `interface.css` | `--ui-surface`, `--ui-header-surface`, `--ui-muted-surface`, `--ui-border`, `--ui-text`, `--ui-secondary`, `--ui-accent`, `--ui-action`, `--ui-danger` | `var(--meow-*)` (`--ui-action` → `var(--meow-action-fill)`) | P0–P3 |
| `globals.css` | `--background`, `--foreground`, `--bg`, `--surface`, `--card`, `--border`, `--text-primary*`, `--color-text-*`, `--color-background-*`, `--color-border-*` | `var(--meow-*)` | P0–P5 |
| Subject / Training / Admin | `--mac-*`, `--tr-*`, `--admin-*`, `--quiz-*`, `--tfp-*` | Scoped onto `--meow-*` inside migrated `[data-meow-tokens]` shells until module deletion | P2–P5 |
