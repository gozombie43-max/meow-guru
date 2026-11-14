# CSS Architecture & Duplication Audit (Phase 0 Baseline)

Generated: 2026-11-13
Scope: All styling sources inside `frontend/`.

---

## 1. CSS Footprint Overview

- **80 standalone CSS / CSS Module files** totaling **43,614 lines** (`1,223,540` bytes).
- **12 TSX files** embedding `<style jsx>` runtime blocks:
  - `features/quiz/components/SubjectTopicStyles.tsx` (733L)
  - `features/quiz/components/ui/QuizStyles.tsx` (343L)
  - `app/(app)/english/_shared/study-mode-start.tsx`
  - `app/(app)/english/_shared/StudyModeTermsQuizEngine.tsx`
  - `app/(app)/resource/resource-model.tsx`
  - `app/providers.tsx`
  - `components/ai/VisualResponse.tsx`
  - `components/LangToggle.tsx`
  - `components/LiquidGlassText.tsx`
  - `features/quiz/components/ui/QuizSettingsModal.tsx`
  - `features/quiz/components/ui/SolutionViews.tsx`
  - `lib/styled-jsx-registry.tsx`
- **No Tailwind `@theme` block**: `app/globals.css` imports Tailwind v4 (`@import "tailwindcss";`), yet design tokens live across competing `:root`, `body.theme-dark`, `html.theme-dark`, `.dark`, and `html.theme-light` selectors in four global files plus page-scoped `:root` / `.page` overrides.

### Largest CSS Files (`>= 749` lines)
| File | Lines | Bytes | Primary Domain |
|---|---:|---:|---|
| `components/training/training-session.css` | 2,852 | 65,013 | Training session UI |
| `components/SubjectHub.module.css` | 2,715 | 67,809 | Subject hub landing & macOS window chrome |
| `features/quiz/components/views/mobile-quiz-view.css` | 2,384 | 88,591 | Mobile quiz view & metadata sheets |
| `app/(app)/page.module.css` | 2,089 | 50,646 | Home/landing dashboard |
| `app/(app)/english/english.module.css` | 1,926 | 48,248 | English hub & study-mode cards |
| `features/quiz/components/ui/SeriesStartViews.module.css` | 1,844 | 43,626 | Series/topic start screens |
| `app/globals.css` | 1,665 | 42,012 | Tailwind entry, Liquid Glass, shell/nav base |
| `app/(app)/play/play-hub.css` | 1,660 | 43,359 | Play hub modes |
| `components/QuizChatbot/quiz-chatbot.css` | 1,460 | 34,238 | In-quiz AI chatbot drawer |
| `app/(app)/english/_shared/StudyModeComparison.module.css` | 1,455 | 48,394 | English comparison study views |
| `app/(app)/mock-test/page.module.css` | 1,449 | 31,954 | Mock test hub |
| `app/(admin)/admin/notifications/AdminNotificationsPage.module.css` | 1,097 | 22,299 | Admin notifications page |
| `app/(app)/mock-test/_shared/ExamLandingPage.module.css` | 1,084 | 29,040 | Exam landing pages |
| `components/UserProfileMenu.module.css` | 1,066 | 23,263 | User profile dropdown & modal |
| `app/(admin)/admin/users/AdminUsersPage.module.css` | 1,064 | 23,670 | Admin users table & dialogs |
| `components/auth/auth.module.css` | 1,037 | 24,849 | Login/register/reset flows |
| `app/(app)/ai-chat/AiChat.module.css` | 1,031 | 25,222 | AI chat workspace |
| `app/(app)/general-awareness/_shared/RankedTopicGroupPage.module.css` | 989 | 21,397 | Ranked GA topic groups |
| `features/quiz/components/views/ResultView.module.css` | 963 | 21,183 | Quiz result summary |
| `app/(app)/resource/Resource.module.css` | 883 | 26,288 | Resources hub |
| `app/(app)/mock-test/_shared/MockTestEngine.module.css` | 852 | 21,822 | Fullscreen mock test runner |
| `app/(app)/play/play.css` | 798 | 16,059 | Active play view |
| `features/admin/bulk-import/BulkTopicImportManager.module.css` | 766 | 18,115 | Admin bulk topic importer |
| `app/(app)/notifications/notifications.css` | 755 | 18,293 | Notifications feed |
| `features/quiz/components/views/DesktopQuizView.css` | 749 | 24,172 | Desktop quiz runner |

*(25 of 80 CSS files alone account for 32,727 lines.)*

---

## 2. Global CSS Cascade Conflicts (`app/layout.tsx` Load Order)

1. **`globals.css` (1,665L)**:
   - Defines Liquid Glass palette (`--glass-bg`, `--liquid-cyan`, `--radius-card: 24px`, `--radius-btn: 18px`), `.bg-blob-1..3`, `.glass*`, `.liquid-btn*`, `.btn-glow`, `.btn-outline`, `.bottom-pill-nav` (with self-conflicting overrides at L1349–1537), and `body.theme-dark` variables (`--color-text-primary: #ecf3ff`, `--color-background-secondary: rgba(15, 23, 42, 0.78)` at L1540–1556).
2. **`light-theme.css` (194L)**:
   - Declares `--light-canvas: #f5f7fa` in `:root` (L2–16), then immediately overrides it in `html.theme-light` (`--light-canvas: #f4f5f7`, `--light-text: #242830`, `--light-border: #e1e4e8` at L18–74), plus `--light-only-*` bridge tokens and `.bottom-pill-nav.is-light`.
3. **`dark-theme.css` (271L)**:
   - Overrides `:root`/dark canvas with `--oled-canvas: #000000`, `--oled-surface: #1c1c1e`, `--dark-accent: #0a84ff`; restyles `.bottom-pill-nav` (L74–168); injects `!important` `.training-dark` overrides (L171–241); and redefines `--dark-text: #e5eaf0`, `--dark-text-secondary: #a2a9b4`, `--dark-text-muted: #929aa6`, `--dark-border: #38383c` inside `@media (max-width: 767px)` (L245–271).
4. **`interface.css` (445L)**:
   - Attempts to enforce contract uniformity on top of the above using `[data-ui-button]` `!important` rules, mobile `input`/`select` `font-size: max(16px, 1em) !important`, header icon sizing overrides, and `.bottom-pill-nav[data-ui-chrome="footer"]` overrides (L289–348).

Result: Feature CSS modules rely on long `:global(...)` chains (`:global(.theme-dark)`, `:global(body.theme-dark)`, `:global(html.theme-dark)`, `:global(.dark)`, `:global(body:not(.theme-light))`) and `box-shadow: none !important` (59 occurrences across 20 files) to win specificity.

---

## 3. Duplicated `@keyframes`, Class Selectors & Copy-Pasted Rule Blocks

### 3.1 Duplicated `@keyframes` (`7` animations)
| Keyframe | Occurrences | Files |
|---|---:|---|
| `spin` | 11 | `AdminNotificationsPage.module.css`, `AdminUsersPage.module.css`, `access-code/page.module.css`, `StudyModeLoading.module.css`, `ResultReport.module.css`, `ReviewEngine.module.css`, `ScheduledNotificationsPanel.module.css`, `auth.module.css`, `QuestionImage.module.css`, `training-session.css`, `QuestionBankZipUpload.module.css` |
| `fadeIn` | 5 | `AdminNotificationsPage.module.css`, `AdminUsersPage.module.css`, `app/(app)/page.module.css`, `QuestionImage.module.css`, `UserProfileMenu.module.css` |
| `shake` | 2 | `access-code/page.module.css`, `components/auth/auth.module.css` |
| `macWindowPop` | 2 | `english/english.module.css`, `components/SubjectHub.module.css` |
| `micPulse` | 2 | `english/english.module.css`, `components/SubjectHub.module.css` |
| `setupSpin` | 2 | `play/play-hub.css`, `play/setup/[mode]/setup.css` |
| `modalPop` | 2 | `components/auth/auth.module.css`, `components/UserProfileMenu.module.css` |

### 3.2 High-Frequency Repeated Structural Class Names (Across CSS Modules / Global CSS)
- `.header` (17 files), `.page` (13 files), `.card` (13 files), `.spinner` (11 files), `.is-active` (10 files), `.content` (9 files), `.active` (9 files), `.container` (8 files), `.actions` (7 files), `.searchIcon` (7 files), `.searchInput` (7 files), `.emptyState` (7 files), `.eyebrow` (7 files), `.icon` (7 files), `.empty` (6 files), `.headerTitle` (6 files), `.grid` (6 files), `.training-dark` (6 files), `.modalTitle` / `.modalActions` / `.section` / `.heroCard` / `.btnPrimary` / `.backdrop` / `.dialog` (5 files each).

### 3.3 Copy-Pasted Identical Rule Blocks (`50` unique long declarations duplicated across files)
Static AST/block comparison (`deep-audit.json`) flagged **50 identical CSS declaration bodies** copied across independent files, clustering along four copy-paste families:
1. **Subject Hub / English Hub / Series Start Trio** (`app/(app)/english/english.module.css`, `components/SubjectHub.module.css`, `features/quiz/components/ui/SeriesStartViews.module.css`):
   - Share identical macOS window (`--mac-*`), search focus ring (`border-color: var(--mac-blue); box-shadow: 0 0 0 2px var(--mac-blue-subtle);`), `.navBtn:hover:not(:disabled)`, blue button glow shadows, `@keyframes macWindowPop`, `@keyframes micPulse`, and dark grouped-list surface overrides.
2. **Mock Test Hub <-> Exam Landing Pair** (`app/(app)/mock-test/page.module.css`, `app/(app)/mock-test/_shared/ExamLandingPage.module.css`):
   - Duplicate `:global(body:not(.theme-light)) .page` and `:global(body.theme-dark) .page` local token bridge blocks (`--primary: var(--dark-accent); --primary-light: ...; --bg: var(--dark-canvas);`) plus `.activeChip::after` underline indicators (also duplicated in `notifications.css` and `Resource.module.css`).
3. **Search Input & Dark Outline Ring Trio** (`RankedTopicGroupPage.module.css`, `MobileSearchBar.module.css`, `SubjectHub.module.css`):
   - Duplicate `0 0 0 1.5px rgba(255, 255, 255, 0.12) !important` and `0 0 0 1.5px rgba(0, 0, 0, 0.08) !important` ring overrides.
4. **Admin Dark Theme Icon/Role Bridges** (`AdminUsersPage.module.css`, `UserProfileMenu.module.css`):
   - Duplicate multi-selector `:global(.theme-dark)...` blocks setting `background: rgb(var(--ios-system-blue-rgb) / 0.2); color: var(--ios-system-blue);`.

*(In contrast, quiz engine wrapper TSX files across `english/_shared/quiz-engine.tsx`, `general-awareness/_shared/quiz-engine.tsx`, `mathematics/_shared/quiz-engine.tsx`, `reasoning/_shared/quiz-engine.tsx` and their `topic-page.tsx` wrappers are already thin 10–15 line wrappers around `QuizEngine` / `SubjectTopicPage`.)*
