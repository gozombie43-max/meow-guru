# Design Inconsistencies Audit (Phase 0 Baseline)

Generated: 2026-11-13
Scope: `frontend/` static codebase (`80` CSS files, `466` non-test `.ts/.tsx/.js/.jsx` files, `12` `<style jsx>` files).
Target Reference: Meow Phase 1 OLED Dark Spec (`#080C11` bg, `#111722` surface, `#222A38` border, `#F1F4F8` primary text, `#929CAF` secondary, `#687386` muted, `#3B82F6` accent, `#60A5FA` accent light).

---

## 1. Missing Tailwind v4 `@theme` Source of Truth & Multi-Theme Collisions

- `frontend/app/globals.css` begins with `@import "tailwindcss";` (Tailwind CSS v4), **but there is no `@theme` directive anywhere in `frontend/app/`**.
- Instead of one unified token layer, four global stylesheets are loaded sequentially in `frontend/app/layout.tsx` (`globals.css` -> `light-theme.css` -> `dark-theme.css` -> `interface.css`) and compete via CSS custom properties, class selectors (`body.theme-dark`, `html.theme-dark`, `.dark`, `html.theme-light`), and `!important` overrides.
- Across the codebase, **6+ incompatible naming conventions** define overlapping local variables (top defined custom properties: `--bg` 30x across 12 files, `--border` 26x across 10 files, `--text-muted` 22x across 8 files, `--card` 21x across 8 files, `--text-dark` 16x across 5 files, `--surface` 14x across 7 files, `--primary` 14x across 6 files, `--ui-surface` 14x across 7 files, `--text-primary` 12x across 7 files, plus `--mac-*`, `--tr-*`, `--admin-*`, `--ios-*`, `--oled-*`, `--dark-*`, `--light-*`).

---

## 2. Colour & Theme Inconsistencies

### 2.1 Dark Palette Conflict vs. Phase 1 Target Spec
| Role | Phase 1 Target Spec | Current `dark-theme.css` (`--oled-*` / `--dark-*`) | `globals.css` (`body.theme-dark` / Liquid Glass) | Feature Hardcodes (`english/.../quiz`, etc.) |
|---|---|---|---|---|
| Page background | `#080C11` (cool slate OLED) | `--oled-canvas: #000000` / `--dark-canvas: #000000` | `#080c11` via base or `--glass-bg` / `--bg-blob-*` cyan | `bg-[#181613]` (warm sepia-black in 4 English study quiz pages) |
| Surface | `#111722` | `--oled-surface: #1c1c1e` / `--dark-surface: #1c1c1e` | `--color-background-secondary: rgba(15, 23, 42, 0.78)` | `--mac-window-bg`, `--tr-surface`, `--admin-surface-solid` |
| Border | `#222A38` | `rgba(255, 255, 255, 0.12)` (desktop) / `#38383c` (`<768px`) | `--glass-border` | `--mac-border`, `--tr-border`, `--admin-border` |
| Primary text | `#F1F4F8` | `--dark-text: #ffffff` (desktop) / `#e5eaf0` (`<768px`) | `--color-text-primary: #ecf3ff` | `text-[#c9bfa9]` (warm parchment in 5 English study quiz pages) |
| Secondary / Muted text | `#929CAF` / `#687386` | `--oled-secondary: #a2a9b4` / `--dark-text-muted: #929aa6` (`<768px`) | `--color-text-secondary: #9fb1cf` / `--color-text-tertiary: #6b7c97` | `--ink-soft`, `#6e6e73`, `#8e8e93`, `#64748b` |
| Accent | `#3B82F6` / `#60A5FA` | `--dark-accent: #0a84ff` / `--dark-action: #0a84ff` | `--liquid-cyan` / `--ios-system-blue: #007aff` | `#2563eb`, `#0071e3`, `var(--quiz-accent, #3b82f6)`, `--tr-accent` |

### 2.2 Hardcoded Hex Colour Sprawl
Top hardcoded hex values occurring directly in CSS and TSX files (instead of semantic tokens):
- Neutrals / surfaces / text: `#ffffff` (384x, 64 files), `#fff` (115x, 32 files), `#000000` (58x, 27 files), `#e5eaf0` (54x, 14 files), `#1c1c1e` (50x, 23 files), `#a2a9b4` (44x, 15 files), `#6e6e73` (42x, 12 files), `#e2e8f0` (38x, 9 files), `#0f172a` (37x, 16 files), `#8e8e93` (30x, 15 files), `#64748b` (30x, 16 files), `#f8fafc` (25x, 11 files), `#29292c` (22x, 10 files), `#f5f5f7` (16x, 9 files), `#cbd5e1` (14x, 8 files).
- Accents: `#0a84ff` (49x, 16 files), `#007aff` (34x, 19 files), `#2563eb` (34x, 9 files), `#0071e3` (23x, 9 files), `#6366f1` (18x, 13 files), `#8b5cf6` (16x, 12 files).
- Semantic status fragmentation (multiple conflicting greens/reds/ambers): `#dc2626` (43x, 15 files), `#ef4444` (41x, 15 files), `#f87171` (18x, 8 files); `#10b981` (39x, 17 files), `#059669` (22x, 7 files), `#16a34a` (21x, 10 files); `#f59e0b` (37x, 18 files), `#d97706` (18x, 11 files).

### 2.3 Light-Only & Tailwind Named-Color Leakage
- `app/(app)/battle/rewards/page.tsx` uses Tailwind named utility classes (`bg-slate-50`, `text-slate-900`, `text-slate-500`, `text-violet-700`, `bg-emerald-50`) and stays light-only without dark theme tokens.
- `app/(admin)/admin/battle-integrity/page.tsx` and `features/quiz/components/ui/QuestionPalette.tsx` mix Tailwind light utility badges (`bg-rose-100`, `bg-amber-100`, `bg-emerald-100`, `bg-violet-100`, `bg-slate-100`) with CSS variable classes (`text-[var(--admin-text-secondary)]`, `text-[color:var(--quiz-text)]`).
- `app/(app)/english/{homonyms-homophones,idioms-phrases,one-word-substitution,spelling-misspelled-words,synonyms-antonyms}/study-mode/quiz/page.tsx` inject arbitrary warm-dark hexes (`bg-[#181613]`, `text-[#c9bfa9]`) inconsistent with both `#000000` and `#080C11`.

---

## 3. Typography Inconsistencies

### 3.1 Font-Size Scale Sprawl
Although `interface.css` defines only 4 font tokens (`--ui-font-meta: 12px`, `--ui-font-secondary: 13px`, `--ui-font-body: 14px`, `--ui-font-title: 20px`), `--ui-font-meta` is used heavily in only 6 files (93x), while CSS files use over **25 distinct pixel/rem values including half-pixel increments**:
- Common sizes: `12px` (238x, 49f), `13px` (210x, 53f), `11px` (157x, 38f), `14px` (141x, 47f), `16px` (80x, 40f), `15px` (72x, 33f), `10px` (67x, 25f), `18px` (38x, 21f), `17px` (36x, 23f), `20px` (23x, 15f), `22px` (17x, 13f), `19px` (16x, 10f), `24px` (14x, 10f), `9px` (16x, 9f), `21px` (11x, 10f), `30px` (7x), `28px` (7x), `26px` (6x), `23px` (6x).
- Sub-pixel overrides: `11.5px` (77x, 18f), `13.5px` (52x, 20f), `12.5px` (52x, 22f), `10.5px` (29x, 13f), `14.5px` (17x, 13f), `9.5px` (9x, 6f).
- Specificity battles: `12px !important` (13x, 8f) and `13px !important` (8x, 6f).

### 3.2 Font-Family Fragmentation
The codebase declares **30 distinct `font-family` values**, mixing:
- Apple stacks: `-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif` (5x), `SF Pro Display` variants, `'SF Pro Display', 'Helvetica Neue', sans-serif`, `var(--mac-font)`.
- Windows/Cross-platform sans stacks: `Inter, ui-sans-serif, system-ui, sans-serif`, `Segoe UI`, `Roboto`.
- Bengali stacks: `"Noto Sans Bengali", "Hind Siliguri", ... !important`.
- Serif & monospace stacks: `Georgia, 'Times New Roman', serif`, `Georgia, serif`, `'Georgia', 'Palatino Linotype', serif`, `var(--mac-font-mono)`, `ui-monospace, SFMono-Regular, Menlo, ...`.
- `globals.css` also loads Google/external `Nunito Sans` specifically for `.feedback-toast` while `app/layout.tsx` configures GeistSans (`preload: false`) + Noto Sans Bengali.

---

## 4. Radii, Shadows, Spacing & Surface Inconsistencies

### 4.1 Border-Radius Sprawl
While `interface.css` specifies `--ui-radius-sm: 8px`, `--ui-control-radius: 12px`, `--ui-radius-lg: 16px` and `globals.css` specifies `--radius-card: 24px`, `--radius-btn: 18px`, CSS files use every integer from `2px` to `26px`:
- `50%` (142x, 48f) + `50% !important` (16x, 12f)
- `12px` (140x, 50f) + `12px !important` (6x, 4f)
- `10px` (108x, 41f), `8px` (102x, 35f), `14px` (96x, 41f), `16px` (69x, 31f), `6px` (62x, 23f), `20px` (38x, 22f), `9px` (37x, 20f), `11px` (33x, 17f), `7px` (32x, 16f), `18px` (24x, 15f), `5px` (18x, 11f), `24px` (16x, 14f), `22px` (16x, 9f), `4px` (16x, 11f), `13px` (13x, 9f), `26px` (13x, 4f), `2px` (10x, 8f), `3px` (6x, 5f)
- Pills split across `999px` (72x), `999px !important` (14x), `9999px` (32x), `9999px !important` (8x)
- Square resets: `0` (24x) and `0 !important` (13x)

### 4.2 Shadow Wars & Glassmorphism Sprawl
- `box-shadow: none !important` appears **59 times across 20 CSS files** as newer OLED/flat sections explicitly strip older `globals.css` / Liquid Glass shadows.
- Meanwhile, conflicting glow and elevation shadows remain in `globals.css`, `SubjectHub.module.css`, `english.module.css`, and `SeriesStartViews.module.css` (`0 3px 10px rgba(0, 113, 227, 0.28)...`, `0 2px 8px rgb(var(--ios-system-blue-rgb) / 0.35)`, `var(--mac-window-shadow)`, `var(--dark-shadow)`).
- `backdrop-filter` glassmorphism is spread across **25+ CSS files** (most concentrated in `app/globals.css` 28x, `StudyModeComparison.module.css` 14x, `battle/battle.css` 8x, `mock-test/page.module.css` 8x, `mock-test/_shared/ExamLandingPage.module.css` 6x, `ai-chat/AiChat.module.css` 6x, `AdminUsersPage.module.css` 6x, `interface.css` 6x, `page.module.css` 5x), mixing translucent frosted panels with flat solid OLED dark cards (`#000000` / `#1c1c1e`).

---

## 5. Component Contract Gaps & Unstandardized Controls

- **`data-ui-button` adoption vs. holdouts**: `105` TSX files use `data-ui-button` (regulated by `interface.css` `!important` height/radius rules), while **`12` TSX files still render raw `<button>` elements without `data-ui-button`**:
  1. `app/(app)/mock-test/_shared/ReviewQuestionNavigator.tsx`
  2. `app/(app)/play/components/TrainingSetupDialog.tsx`
  3. `app/(app)/preview-palette/page.tsx`
  4. `app/(auth)/check-email/page.tsx`
  5. `app/(auth)/reset-password/page.tsx`
  6. `components/ExamModeSwitch.tsx`
  7. `components/MacTrafficLights.tsx`
  8. `components/QuestionImage.tsx`
  9. `components/subject-hub/MobileSearchBar.tsx`
  10. `components/training/TrainingSelectDropdown.tsx`
  11. `features/admin/bulk-import/BulkTopicImportManager.tsx`
  12. `features/quiz/components/ui/QuizSettingsModal.tsx`
- **Custom modal/overlay divergence**: While `29` callers use `@/components/ui/Dialog`, `5` non-primitive files still implement custom overlays (`ranked-topic-group-page.tsx`, `MockTestEngine.tsx`, `preview-palette/page.tsx`, `SelectionPopover.tsx`, `BulkTopicImportManager.tsx`).
- **Touch target & policy violations**: `features/quiz/components/SubjectTopicStyles.tsx` overrides `.sg-back` to `width: 36px !important` (below the `44px` `--ui-control-height` minimum).
