# Phase 1 — Approved Page Templates (`templates.md`)

Every route in `frontend/app/` MUST declare and compose one of **5 canonical layout templates** (with explicit Auth & Admin specializations). A template governs **chrome, responsive grid, max-width, scroll/safe-area container, and async boundaries** — not rigid inner widget order.

> **Hard Shell Law (Across ALL Templates):**  
> Ban `100vh` and `min-h-screen` everywhere. Root heights use `min-height: 100dvh` (`dvh`) cleanly inside flex/grid columns, keeping `AppHeader` (`56px + --safe-top`) and `BottomNav` (`--meow-bottom-nav-h + --safe-bottom` when visible) free of clipping or double scrollbars.

---

## Template A — `DashboardTemplate`
**Intended Routes:** `/`, `/dashboard` (consolidate `/dashboard/overview`), `/profile`, `/play`, `/battle/profile`, `/admincontrol`, `/admin/upload`.

| Dimension | Specification |
|---|---|
| **Mobile Layout (`< 768px`)** | Single-column vertical stack (`16px` horizontal gutter, `16px`–`24px` section gap). Top compact greeting/status header; horizontally scrollable or 2-up compact KPI cards (`minmax(150px, 1fr)` grid, never fixed pixel overflow); vertical module cards. |
| **Tablet Layout (`768px–1023px`)** | `24px` gutter; 2-column summary grid; BottomNav dock still active (`<= 1023px`). |
| **Desktop Layout (`>= 1024px`)** | Left navigation rail or integrated top bar (`min-width: 1024px`, BottomNav hidden); centered main container `max-width: 1200px` (`24px`–`32px` padding); 2–3 column bento grid for KPIs + primary action cards + recent activity feed. |
| **Header & Nav Behaviour** | Root pages (`/` , `/play`, `/profile`) show `BottomNav` on `< 1024px` and top/rail nav on desktop. Nested `/dashboard` hides `BottomNav` per `shell-policy.ts` and renders `AppHeader` with `BackButton`. |
| **Loading / Empty / Error** | Skeleton KPI strip + card placeholders; Empty state CTA card for first-time learners; Inline `ErrorState` with retry button (`route-boundary`). |

---

## Template B — `ListingTemplate`
**Intended Routes:** `/mathematics`, `/reasoning`, `/english`, `/general-awareness`, `/general-awareness/[topic]` (ranked list), `/subjects/[subject]/[topic]`, `/mock-test`, `/mock-test/[examSlug]`, `/notifications`, `/resource`, `/battle/{missions,social,rewards}`, `/admin`, `/admin/mock-pyq`, `/admin/users`.

| Dimension | Specification |
|---|---|
| **Mobile Layout (`< 768px`)** | Single-column scrollable list (`12px`–`16px` gutter). Sticky/top search & horizontal scrollable filter chips (`SearchInput` + `Tabs variant="pill"`); stacked `Card` or grouped `Panel` list rows (no fake desktop macOS window chrome on mobile). |
| **Tablet Layout (`768px–1023px`)** | 2-column topic/exam card grid (`gap: 16px`), persistent search/filter toolbar above grid. |
| **Desktop Layout (`>= 1024px`)** | Centered `max-width: 1200px` (`Admin` tables up to `1360px`); integrated search + filter bar (optional collapsible left filter sidebar on large catalogs); 2–3 column card grid or structured `DataTable` for admin/PYQ management. |
| **Header & Nav Behaviour** | Top-level Subject Hubs, `/mock-test`: `AppHeader` + `BottomNav` (`< 1024px`). Leaf listings (`/notifications`, `/resource`, `/battle/*`, `/mock-test/[examSlug]`): `AppHeader` with `BackButton`, `BottomNav` hidden (`shell-policy.ts` updated so `/battle/rewards` matches). |
| **Loading / Empty / Error** | Filter-preserving skeleton list/cards (search bar stays interactive while results load); Clear-filters CTA in `EmptyState`; inline retry banner on fetch failure. |

---

## Template C — `QuizTemplate`
**Intended Routes:** `/[subject]/[topic]/quiz`, `/[subject]/[topic]/[chapter]/quiz`, `/english/.../study-mode/quiz`, `/mock-test/[examSlug]/[testId]/attempt`, `/mock-test/[examSlug]/[testId]/review/[attemptId]`, `/play/session/[id]`, `/battle` (active match), `/ai-chat` (specialized fullscreen workspace variant).

> **Domain UX Preservation Rule:** Practice Quiz, Mock Test (`attempt` & `review`), Training Session, Study Mode, and Battle share this chrome shell while keeping their domain controls (instant explanation vs exam holdback, sectional tabs, live battle opponent bar, AI tutor drawer).

| Dimension | Specification |
|---|---|
| **Mobile Layout (`< 768px`)** | Full-viewport flex column (`height: 100dvh`, `overflow: hidden` only on locked chrome if scrolling inner question pane safely with `--safe-top`/`--safe-bottom`): fixed `56px` QuizTopBar (`BackButton`/Exit guard, question counter `tabular-nums`, `TimerPill`, palette drawer trigger, settings icon) → scrollable `QuestionCard` + `OptionButton` stack → fixed bottom action footer (`Previous` / `Mark` / `Next` / `Submit`, `>= 44px` controls, keyboard-aware via `VirtualKeyboardProvider`). |
| **Tablet Layout (`768px–1023px`)** | Expanded question reading column (`max-width: 720px` centered) with slide-over `BottomSheet`/drawer question palette (`QuestionPalette`) and bottom navigation controls. |
| **Desktop Layout (`>= 1024px`)** | Two-pane grid inside `100dvh` (`max-width: 1360px` centered): Primary left reading column (`minmax(0, 1fr)`, optimal `68ch`–`760px` stem line length) + right sticky Question Palette / Timer / Section sidebar (`320px`–`360px`, optional in distraction-free Study Mode). |
| **Header & Nav Behaviour** | **Always fullscreen (`BottomNav` always hidden)**; back/exit navigation MUST route through `useQuizLeaveGuard` (`QuizExitDialog` confirmation when active attempt exists). |
| **Loading / Empty / Error** | Centered question loader (`Spinner` + concise label) preserving top bar exit button; `ErrorState` with "Retry / Return to Hub" so users are never trapped in fullscreen chrome. |

---

## Template D — `ConfigurationTemplate`
**Intended Routes:** `/mathematics/[topic]`, `/reasoning/[topic]`, `/english/[topic]`, `/general-awareness/[topic]/[chapter]`, `/subjects/[subject]/[topic]/[chapter]`, `/english/*/study-mode`, `/mock-test/[examSlug]/[testId]` (instructions), `/play/setup/[mode]`, `/battle` (lobby), `/admin/notifications`, `/admin/upload/*`, `/access-code`, `(auth)/*` (Login, Register, Verify, Reset — centered compact form specialization).

| Dimension | Specification |
|---|---|
| **Mobile Layout (`< 768px`)** | `AppHeader` (`BackButton` + title) → vertically grouped option `Panel`s (`16px` gutter, clear section headings, switches/segmented pickers/filter selects with `>= 44px` rows) → sticky bottom primary CTA bar (`Start Quiz` / `Begin Test` / `Save`, `min-height: 48px` + `var(--safe-bottom)`). |
| **Tablet Layout (`768px–1023px`)** | Single centered column (`max-width: 680px`) with inline sticky CTA footer or card-contained summary action. |
| **Desktop Layout (`>= 1024px`)** | Single centered column (`max-width: 720px`) for simple setups/auth (`440px` card max for `(auth)/*` and `/access-code`), or asymmetric 2-column (`1fr 340px`: settings left + live session summary & primary CTA right) for multi-parameter Topic/Training/Admin builders. |
| **Header & Nav Behaviour** | Topic entry pages keep `BottomNav` (`< 1024px`) when acting as browsable hub leaves, OR suppress it consistently on setup/instructions/study-mode/auth routes (`shell-policy.ts` rule: `/english/*/study-mode` unified to hide `BottomNav`). |
| **Loading / Empty / Error** | Section skeleton rows; form-level `aria-live` error banner above primary CTA + field-level validation messages (`--meow-error`). |

---

## Template E — `AnalyticsTemplate`
**Intended Routes:** `/mock-test/[examSlug]/[testId]/result/[attemptId]`, `/battle/leaderboard`, `/admin/battle-integrity`, plus post-session result views inside `/play/session/[id]` (`TrainingResults` / `TrainingInsights`) and `QuizEngine` (`ResultView`).

| Dimension | Specification |
|---|---|
| **Mobile Layout (`< 768px`)** | `AppHeader` (title + Back/Done + Share/Filter action) → hero score/rank `Card` → 2-column `StatCard` metrics grid → stacked breakdown panels (accuracy bar charts with exempted domain hues, topic table/rows, review CTAs). |
| **Tablet Layout (`768px–1023px`)** | Centered `max-width: 840px`; 4-up metric strip (`2x2` or `4x1`) + 2-column breakdown cards. |
| **Desktop Layout (`>= 1024px`)** | Centered `max-width: 1200px`; 4-column metric strip (`StatRow`) → 2-column chart/distribution grid (`ChartCard`) → full-width breakdown `DataTable` or solution review trigger list. |
| **Header & Nav Behaviour** | `BottomNav` hidden (task completion focus); clear primary CTA ("Review Solutions" / "Retake" / "Back to Hub"). |
| **Loading / Empty / Error** | Chart/table skeletons maintaining card heights (`CLS <= 0.10`); Empty state if 0 attempts yet; Error banner with retry preserving attempt ID context. |

---

## Specialized Cross-Cutting Routes & Formula Notes

| Route Family | Assigned Template | Notes |
|---|---|---|
| `*/formula-notes` (`FormulaNotesPage`) | **Listing / Reading Variant** (Derived from `Template B` / `Template D` reading width `max-width: 820px`) | Optimized reading typography (`16px`/`1.6` KaTeX formulas), collapsible chapter outline on desktop, hidden `BottomNav` with `AppHeader`. |
| `/ai-chat` (`AiChatPage`) | **Quiz / Workspace Shell Variant** (`Template C` 2-pane `100dvh` workspace) | Collapsible conversation drawer (`< 1024px`), fixed `260px`–`280px` sidebar (`>= 1024px`), safe-area keyboard composer pinned at bottom. |
| `/glass-test`, `/preview-palette`, `/dev/convex-auth` | **Dev-Only (Excluded from Production UX)** | Moved behind development-only guards per Decision 2 (`migration-rules.md`). |
