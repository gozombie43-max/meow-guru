# Phase 1 — Shared Component Library Contracts (`components.md`)

All components in `frontend/design-system/components/` MUST style via `--meow-*` semantic tokens (working identically in dark and light themes), avoid inline `<style jsx>`, enforce keyboard/focus/ARIA accessibility, and replace ad-hoc duplicated page UI.

---

## 1. Foundation Primitives

| Component | Role | Props / API Contract | Key Rules |
|---|---|---|---|
| `Text` / `Heading` | Typographic hierarchy | `as`, `variant: 'display' \| 'title' \| 'heading' \| 'body' \| 'question' \| 'secondary' \| 'meta' \| 'micro'`, `tone: 'primary' \| 'secondary' \| 'muted' \| 'accent' \| 'success' \| 'warning' \| 'error'`, `lang?: 'en' \| 'bn'`, `tabular?: boolean` | Maps strictly to the `tokens.md` type scale; `meta`/`micro` restricted from interactive labels unless `tone !== 'muted'` in dark mode. |
| `Icon` | Standardized icon container | `icon`, `size: 'sm' (16) \| 'md' (20) \| 'lg' (24)`, `tone` | Ensures consistent `lucide-react` & custom SVG geometry (`strokeWidth={1.75}` default). |
| `Stack` / `Inline` | Layout spacing primitives | `gap: 1 \| 2 \| 3 \| 4 \| 6 \| 8`, `align`, `justify`, `wrap` | Enforces `4px` multiple grid alignment (`var(--meow-space-*)`). |

---

## 2. Navigation Components

| Component | Replaces | Contract & States | Accessibility & Responsive Rules |
|---|---|---|---|
| `AppHeader` | `17` duplicate `.header` implementations + ad-hoc back bars | Slots: `leading` (default `BackButton`), `title`, `subtitle?`, `actions?`; `sticky?: boolean`; `variant: 'default' \| 'transparent' \| 'compact'` | Fixed height `var(--meow-header-h)` (`56px`) + `var(--safe-top)`; `1px solid var(--meow-border)` bottom divider (`var(--meow-bg)` / `var(--meow-surface)` — no glass blur required). |
| `BackButton` | Ad-hoc `.backBtn`, `.fn-back-btn`, `.notif-back-btn`, `.sg-back` (`36px` bug) | Extends `Button variant="ghost" size="icon"` wrapping existing `useAppNavigation` / `router.back()` fallback | Mandatory `44×44px` hit area (`var(--meow-control-h-md)`), `aria-label` required, replaces `.sg-back { width: 36px }`. |
| `BottomNav` / `NavRail` | Fragmented `globals.css` / `dark-theme.css` / `light-theme.css` / `interface.css` dock rules | Renders tab items governed strictly by unified `lib/shell-policy.ts`; states: `default`, `active` (`--meow-accent-soft` pill + `--meow-accent-light` ink), `badge` | Visible `< 1024px` (`mobile` & `tablet`), hidden `>= 1024px` (`desktop`) where desktop navigation rail/bar renders cleanly (eliminating the `1024`/`1025` gap). |
| `Tabs` / `SegmentedControl` | Ad-hoc `.activeChip::after`, `AdminShell` tabs, `ExamModeSwitch`, Study-mode tabs | `items`, `value`, `onChange`, `variant: 'pill' \| 'underline' \| 'segmented'`, `fullWidth?` | Full `role="tablist"` / `role="tab"` / `aria-selected` + arrow-key navigation; height `>= 44px` on touch. |

---

## 3. Actions (`Button`)

Replaces raw `<button>` tags (`12` holdout files) and manual `data-ui-button="..."` attributes (`105` files) with one typed `<Button>` primitive (`frontend/design-system/components/Button.tsx`):

- **Still stamps `data-ui-button`** cleanly during transition so `scripts/check-interface.mjs` and `scripts/check-ui-contract.mjs` continue to pass on every PR.
- **Required Variants** (`variant`):
  1. `primary` — Background `var(--meow-action-fill)` (`#2563EB`, `5.17:1` contrast with white text), border `var(--meow-action-fill)`, text `var(--meow-on-accent)` (`#FFFFFF`); hover `var(--meow-action-fill-hover)` (`#1D4ED8`) cleanly without glow/box-shadow.
  2. `secondary` — Background `var(--meow-surface)`, border `1px solid var(--meow-border)`, text `var(--meow-text)`; hover `var(--meow-surface-subtle)` + `var(--meow-border-strong)`.
  3. `ghost` — Transparent background/border, text `var(--meow-secondary)`; hover `var(--meow-surface-subtle)` + `var(--meow-text)`.
  4. `destructive` — Background `var(--meow-danger-fill)` (`solid`) or `var(--meow-error-soft)` (`subtle`), text `#FFFFFF` / `var(--meow-error)`.
- **Required Interaction States & Props**:
  - `loading?: boolean` — Shows standardized `Spinner size="sm"`, sets `aria-busy="true"` & `disabled` semantics while preserving button width (no layout shift).
  - `disabled?: boolean` — `opacity: 0.45`, `cursor: not-allowed`, no hover tint.
  - `size?: 'sm' | 'md' | 'lg' | 'icon'` — Mobile min-height ALWAYS `44px` (`--meow-control-h-md`); `lg` = `48px`; `sm` = `36px` permitted only on `@media (min-width: 1024px) and (pointer: fine)` (e.g., dense Admin tables); `icon` = `44×44px` square/circle requiring `aria-label`.
  - Focus ring: `2px solid var(--meow-accent)` outline with `2px` offset (`focus-visible` only).

---

## 4. Containers

| Component | Replaces | Contract & Variants |
|---|---|---|
| `Card` | `13` separate `.card` / `.heroCard` / `--mac-window` card classes | `variant: 'default' \| 'subtle' \| 'interactive' \| 'accent-outline'`, `padding: 'none' \| 'sm' (12) \| 'md' (16) \| 'lg' (24)`, `as` / `onClick?`. Surface `#111722` (`dark`) / `#FFFFFF` (`light`), border `1px solid var(--meow-border)`, radius `var(--meow-radius-lg)` (`16px`), **no `backdrop-filter` or `box-shadow`**. |
| `Section` | `.section` / header-body blocks | `title?`, `description?`, `action?`, spacing `--meow-space-4` header gap, `--meow-space-6` block margin. |
| `Panel` | Study-mode grouped lists, settings panels, sidebar drawers | Grouped list container with internal `1px solid var(--meow-border)` hairlines between child rows (`divide-y`). |

---

## 5. Form Controls

All form text controls enforce `font-size >= 16px` (`--meow-text-md`) on mobile viewports (`< 768px` / `pointer: coarse`) to prevent iOS Safari auto-zoom, and `min-height: 44px`:

| Component | Contract & Variants | Accessibility Rules |
|---|---|---|
| `Input` / `Textarea` | `label`, `hint?`, `error?`, `leadingIcon?`, `trailingAction?`, `disabled` | Explicit `<label htmlFor>`, `aria-invalid`, `aria-describedby` linked to error text (`--meow-error`). Surface `var(--meow-surface-subtle)`, border `var(--meow-border)`, focus border `var(--meow-accent)`. |
| `SearchInput` | Consolidates `9` separate search bar implementations (`SubjectHub`, `MobileSearchBar`, `RankedTopicGroupPage`, `HomeClient`, etc.) | Built on `Input` with leading search icon + `44×44px` clear button when non-empty + optional `⌘K`/shortcut hint on desktop only. |
| `Select` / `FilterSelect` | Unifies native `<select>` + custom filter pickers (`TrainingFilterPicker`, `TrainingSelectDropdown`, `IosExamPicker`) | Consistent chevron, `44px` trigger, keyboard navigation (`Escape`, Arrow keys), bottom-sheet presentation on mobile `< 768px` and popover menu on desktop. |
| `Checkbox` & `Switch` | Settings toggles, bulk selection checkboxes (`AdminUsersTable`) | Minimum `44×44px` hit box (even when visual track/box is `20px`/`44×26px`), native `<input type="checkbox">` or `role="switch"` with `aria-checked`. |

---

## 6. Feedback & Overlay Primitives

| Component | Replaces | Contract & Rules |
|---|---|---|
| `ModalDialog` / `BottomSheet` / `ConfirmDialog` | Unstyled `Dialog.tsx` (`29` inconsistent wrappers) + `6` custom modals (`MockTestEngine`, `ranked-topic-group-page`, `BulkTopicImportManager`, etc.) | Keeps `components/ui/Dialog.tsx` focus trap, `inert` background, `Escape`, and browser `useBackLayer` engine intact while enforcing standardized header (`title`, `44×44` close `Button`), body padding (`16px`–`24px`), footer action alignment, `var(--meow-surface)` background, `1px solid var(--meow-border)`, and `--meow-scrim` backdrop. `BottomSheet` renders mobile sheet (`<= 767px`, `max-height: 85dvh`, `--meow-radius-xl` top corners) and centered dialog on tablet/desktop. |
| `Toast` (`FeedbackToast`) | Global `.feedback-toast` (`Nunito Sans` mismatch in `globals.css`) | Uses `--meow-font-sans`, semantic variants (`info`, `success`, `warning`, `error`), `role="status"` / `aria-live="polite"`, `safe-bottom` clearance. |
| `Tooltip` | Native `title` or ad-hoc hover text | Desktop/hover only (`@media (hover: hover)`), triggers on focus too (`role="tooltip"`). |
| `Badge` | `bg-rose-100`, `bg-emerald-100`, inline pill styles | `variant: 'neutral' \| 'accent' \| 'success' \| 'warning' \| 'error' \| 'info'`, `size: 'sm' \| 'md'`. |
| `Spinner` & `Skeleton` | `11` duplicated `.spinner` rules + route skeleton variants | Single SVG/CSS `Spinner` (`@keyframes meow-spin`) and `Skeleton` block using `--meow-surface-subtle` pulse (disabled cleanly under `prefers-reduced-motion`). |
| `EmptyState` & `ErrorState` | `7` `.emptyState` / `6` `.empty` classes + `RouteErrorState` | Centered stack (`Icon size="lg"`, `Heading`, supporting copy in `--meow-secondary`, optional retry `Button`), **no `100vh` centering**. |

---

## 7. Data Display Components

| Component | Usage | Contract |
|---|---|---|
| `StatCard` / `StatRow` | Dashboard KPIs, Battle Profile, Admin control cards, Result summaries | `label`, `value` (`tabular-nums`), `delta?`, `tone?`, `icon?` (`Card padding="md"`). |
| `ProgressBar` | Subject mastery, daily missions, quiz progress, upload progress | `value`, `max`, `tone`, `showLabel?`, `height: 'sm' (4px) \| 'md' (8px)`, track `var(--meow-surface-subtle)`. |
| `DataTable` | Admin users, mock PYQ papers, battle integrity logs | Sticky header (`var(--meow-surface-subtle)`), `1px solid var(--meow-border)` rows, horizontal scroll wrapper (`overflow-x: auto`) on `< 768px` so no page-level horizontal overflow occurs. |

---

## 8. Shared Quiz & Assessment Primitives (`design-system/components/quiz/` + `features/quiz/`)

Visual building blocks shared across Practice (`QuizEngine`), Mock Test (`MockTestEngine`), Training (`TrainingSessionView`), Battle (`BattlePage`), and English Study Modes — **while each engine retains its own state machine, scoring, and navigation flow**:

| Component | Shared Contract | Preserved Mode-Specific Variations |
|---|---|---|
| `QuestionCard` | Standardized question stem container (`var(--meow-surface)`, `var(--meow-border)`, `16px`/`24px` padding, `var(--meow-text-md)` body/KaTeX/Bengali slot, image lightbox trigger, bookmark/flag slot). | Battle adds opponent header strip; Study Mode supports term/comparison dual-column slot. |
| `OptionButton` | Tactile answer option (`min-height: 48px`, option letter badge `A/B/C/D`, text slot, full keyboard/radio/button semantics); explicit states: `default`, `hover`, `selected` (`--meow-accent-soft` + `--meow-accent`), `correct` (`--meow-success-soft` + `--meow-success`), `incorrect` (`--meow-error-soft` + `--meow-error`), `disabled`. | Mock Test suppresses instant `correct`/`incorrect` reveal until review mode. |
| `TimerPill` | Tabular monospace (`--meow-font-mono`, `tabular-nums`) clock pill (`normal`, `warning <= 20%`, `critical <= 10%` semantic states). | Exam countdown vs elapsed timer vs Battle per-question countdown. |
| `AnswerStatusBadge` & `PaletteGrid` | Shared palette drawer/sheet grid (`unvisited`, `not-answered`, `answered`, `marked`, `answered-marked`, `current`) with clear shape/border contrast + color indicators so color is never the sole cue. | Mock Test sectional tabs vs Practice flat grid vs Training pace indicator. |
